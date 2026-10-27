"""SQLite storage for Party HQ.

Everything lives in one small database file. Calls are short and run under a
lock, which is plenty for a party-sized crowd (tens of people).
"""

import secrets
import sqlite3
import threading
import time

EMOJI_COUNT = 24   # must match EMOJI in static/app.js
COLOR_COUNT = 8    # must match COLORS in static/app.js
HISTORY = 300      # messages sent to a browser when it connects
KEEP = 2000        # messages kept in the database

SCHEMA = """
CREATE TABLE IF NOT EXISTS info (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL DEFAULT '',
    when_text TEXT NOT NULL DEFAULT '',
    where_text TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    token_hash TEXT UNIQUE NOT NULL,
    codename TEXT NOT NULL,
    emoji INTEGER NOT NULL,
    color INTEGER NOT NULL,
    joined_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pid TEXT NOT NULL,
    kind TEXT NOT NULL,
    text TEXT NOT NULL DEFAULT '',
    aid TEXT,
    ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS activities (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    pid TEXT NOT NULL,
    ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS votes (
    pid TEXT NOT NULL,
    aid TEXT NOT NULL,
    v INTEGER NOT NULL,
    PRIMARY KEY (pid, aid)
);
"""


def now_ms() -> int:
    return int(time.time() * 1000)


class Store:
    def __init__(self, path: str):
        self.db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.db.row_factory = sqlite3.Row
        self.lock = threading.Lock()
        with self.lock:
            self.db.execute("PRAGMA journal_mode=WAL")
            self.db.execute("PRAGMA foreign_keys=ON")
            self.db.executescript(SCHEMA)

    # ---------- reads ----------
    def snapshot(self) -> dict:
        with self.lock:
            info = self.db.execute("SELECT name, when_text, where_text FROM info WHERE id = 1").fetchone()
            players = [self._player(r) for r in self.db.execute("SELECT * FROM players")]
            msgs = self.db.execute("SELECT * FROM messages ORDER BY id DESC LIMIT ?", (HISTORY,)).fetchall()
            acts = [self._activity(r) for r in self.db.execute("SELECT * FROM activities ORDER BY ts")]
            notices = [self._notice(r) for r in self.db.execute("SELECT * FROM notices ORDER BY ts")]
            votes: dict[str, dict[str, int]] = {}
            for r in self.db.execute("SELECT pid, aid, v FROM votes WHERE v != 0"):
                votes.setdefault(r["pid"], {})[r["aid"]] = r["v"]
        return {
            "info": self._info(info),
            "players": players,
            "messages": [self._message(r) for r in reversed(msgs)],
            "activities": acts,
            "notices": notices,
            "votes": votes,
        }

    def player_by_token(self, token_hash: str):
        with self.lock:
            r = self.db.execute("SELECT * FROM players WHERE token_hash = ?", (token_hash,)).fetchone()
        return self._player(r) if r else None

    def player_count(self) -> int:
        with self.lock:
            return self.db.execute("SELECT COUNT(*) FROM players").fetchone()[0]

    def codename_taken(self, codename: str, exclude_pid: str | None) -> bool:
        with self.lock:
            r = self.db.execute(
                "SELECT 1 FROM players WHERE lower(codename) = lower(?) AND id IS NOT ?",
                (codename, exclude_pid),
            ).fetchone()
        return r is not None

    def activity(self, aid: str):
        with self.lock:
            r = self.db.execute("SELECT * FROM activities WHERE id = ?", (aid,)).fetchone()
        return self._activity(r) if r else None

    def activity_by_title(self, title: str):
        with self.lock:
            r = self.db.execute("SELECT * FROM activities WHERE lower(title) = lower(?)", (title,)).fetchone()
        return self._activity(r) if r else None

    # ---------- writes ----------
    def upsert_player(self, token_hash: str, codename: str, emoji: int, color: int) -> tuple[dict, bool]:
        """Create or update the player bound to this browser token. Returns (player, created)."""
        with self.lock:
            r = self.db.execute("SELECT id FROM players WHERE token_hash = ?", (token_hash,)).fetchone()
            if r:
                self.db.execute(
                    "UPDATE players SET codename = ?, emoji = ?, color = ? WHERE id = ?",
                    (codename, emoji, color, r["id"]),
                )
                pid, created = r["id"], False
            else:
                pid, created = secrets.token_urlsafe(8), True
                self.db.execute(
                    "INSERT INTO players (id, token_hash, codename, emoji, color, joined_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (pid, token_hash, codename, emoji, color, now_ms()),
                )
            row = self.db.execute("SELECT * FROM players WHERE id = ?", (pid,)).fetchone()
        return self._player(row), created

    def add_message(self, pid: str, kind: str, text: str = "", aid: str | None = None) -> dict:
        with self.lock:
            cur = self.db.execute(
                "INSERT INTO messages (pid, kind, text, aid, ts) VALUES (?, ?, ?, ?, ?)",
                (pid, kind, text, aid, now_ms()),
            )
            row = self.db.execute("SELECT * FROM messages WHERE id = ?", (cur.lastrowid,)).fetchone()
            if cur.lastrowid % 100 == 0:
                self.db.execute("DELETE FROM messages WHERE id <= ?", (cur.lastrowid - KEEP,))
        return self._message(row)

    def add_activity(self, title: str, pid: str) -> dict:
        aid = secrets.token_urlsafe(8)
        with self.lock:
            self.db.execute(
                "INSERT INTO activities (id, title, pid, ts) VALUES (?, ?, ?, ?)",
                (aid, title, pid, now_ms()),
            )
            row = self.db.execute("SELECT * FROM activities WHERE id = ?", (aid,)).fetchone()
        return self._activity(row)

    def remove_activity(self, aid: str) -> None:
        with self.lock:
            self.db.execute("DELETE FROM activities WHERE id = ?", (aid,))
            self.db.execute("DELETE FROM votes WHERE aid = ?", (aid,))

    def set_vote(self, pid: str, aid: str, v: int) -> None:
        with self.lock:
            if v == 0:
                self.db.execute("DELETE FROM votes WHERE pid = ? AND aid = ?", (pid, aid))
            else:
                self.db.execute(
                    "INSERT INTO votes (pid, aid, v) VALUES (?, ?, ?) "
                    "ON CONFLICT (pid, aid) DO UPDATE SET v = excluded.v",
                    (pid, aid, v),
                )

    def notice_count(self) -> int:
        with self.lock:
            return self.db.execute("SELECT COUNT(*) FROM notices").fetchone()[0]

    def add_notice(self, text: str) -> dict:
        nid = secrets.token_urlsafe(8)
        with self.lock:
            self.db.execute("INSERT INTO notices (id, text, ts) VALUES (?, ?, ?)", (nid, text, now_ms()))
            row = self.db.execute("SELECT * FROM notices WHERE id = ?", (nid,)).fetchone()
        return self._notice(row)

    def remove_notice(self, nid: str) -> bool:
        with self.lock:
            return self.db.execute("DELETE FROM notices WHERE id = ?", (nid,)).rowcount > 0

    def set_info(self, name: str, when: str, where: str) -> dict:
        with self.lock:
            self.db.execute(
                "INSERT INTO info (id, name, when_text, where_text, updated_at) VALUES (1, ?, ?, ?, ?) "
                "ON CONFLICT (id) DO UPDATE SET name = excluded.name, when_text = excluded.when_text, "
                "where_text = excluded.where_text, updated_at = excluded.updated_at",
                (name, when, where, now_ms()),
            )
            row = self.db.execute("SELECT name, when_text, where_text FROM info WHERE id = 1").fetchone()
        return self._info(row)

    def backup(self, dest: str) -> None:
        with self.lock:
            target = sqlite3.connect(dest)
            with target:
                self.db.backup(target)
            target.close()

    # ---------- row shapes sent to browsers ----------
    @staticmethod
    def _player(r) -> dict:
        return {"id": r["id"], "codename": r["codename"], "emoji": r["emoji"], "color": r["color"], "joinedAt": r["joined_at"]}

    @staticmethod
    def _message(r) -> dict:
        return {"id": str(r["id"]), "pid": r["pid"], "kind": r["kind"], "text": r["text"], "aid": r["aid"] or "", "ts": r["ts"]}

    @staticmethod
    def _activity(r) -> dict:
        return {"id": r["id"], "title": r["title"], "pid": r["pid"], "ts": r["ts"]}

    @staticmethod
    def _notice(r) -> dict:
        return {"id": r["id"], "text": r["text"], "ts": r["ts"]}

    @staticmethod
    def _info(r) -> dict:
        if not r:
            return {"name": "", "when": "", "where": ""}
        return {"name": r["name"], "when": r["when_text"], "where": r["where_text"]}

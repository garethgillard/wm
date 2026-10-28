"""Storage for the WM gathering: SQLite by default, or Postgres when DATABASE_URL is set.

SQLite keeps everything in one small file (fine on a server with a disk that lasts).
Postgres is for hosts whose disk is wiped on restart, such as Render's free tier.
Calls are short and run under a lock, which is plenty for a party-sized crowd.
"""

import logging
import secrets
import sqlite3
import threading
import time

log = logging.getLogger("wm.store")

EMOJI_COUNT = 56   # must match EMOJI in web/src/lib/constants.js
COLOR_COUNT = 16   # must match ROBES in web/src/lib/constants.js
HISTORY = 300      # messages sent to a browser when it connects
DEFAULT_WHEN = "Friday 30 October"   # shown until the organiser edits the summons
DEFAULT_WHERE = "CIGENE"
KEEP = 2000        # messages kept in the database
REACTION_COUNT = 8 # must match REACTIONS in web/src/lib/constants.js

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
    joined_at INTEGER NOT NULL,
    rsvp TEXT
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
CREATE TABLE IF NOT EXISTS reactions (
    mid INTEGER NOT NULL,
    pid TEXT NOT NULL,
    e INTEGER NOT NULL,
    PRIMARY KEY (mid, pid, e)
);
CREATE TABLE IF NOT EXISTS votes (
    pid TEXT NOT NULL,
    aid TEXT NOT NULL,
    v INTEGER NOT NULL,
    PRIMARY KEY (pid, aid)
);
"""


class _Postgres:
    """A Postgres connection that takes SQLite-style `?` placeholders and reconnects if the server restarts."""

    def __init__(self, url: str):
        import psycopg
        from psycopg.rows import dict_row
        self.psycopg, self.dict_row, self.url = psycopg, dict_row, url
        self.conn = None

    def _connect(self):
        self.conn = self.psycopg.connect(self.url, autocommit=True, row_factory=self.dict_row, connect_timeout=15)

    def execute(self, sql: str, params=()):
        sql = sql.replace("?", "%s")
        for attempt in (1, 2):
            try:
                if self.conn is None or self.conn.closed:
                    self._connect()
                return self.conn.execute(sql, params or None)
            except (self.psycopg.OperationalError, self.psycopg.InterfaceError):
                if attempt == 2:
                    raise
                log.warning("database connection lost; reconnecting")
                self.conn = None

    def executescript(self, sql: str):
        self.execute(sql)


def now_ms() -> int:
    return int(time.time() * 1000)


class Store:
    def __init__(self, path: str, database_url: str = ""):
        self.lock = threading.Lock()
        self.postgres = bool(database_url)
        with self.lock:
            if self.postgres:
                self.db = _Postgres(database_url)
                # Millisecond timestamps need 64-bit integers in Postgres.
                schema = SCHEMA.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "BIGSERIAL PRIMARY KEY").replace("INTEGER", "BIGINT")
                self.db.executescript(schema)
                self.db.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS rsvp TEXT")
            else:
                self.db = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
                self.db.row_factory = sqlite3.Row
                self.db.execute("PRAGMA journal_mode=WAL")
                self.db.execute("PRAGMA foreign_keys=ON")
                self.db.executescript(SCHEMA)
                # Databases made before attendance existed get the new column.
                cols = {r[1] for r in self.db.execute("PRAGMA table_info(players)")}
                if "rsvp" not in cols:
                    self.db.execute("ALTER TABLE players ADD COLUMN rsvp TEXT")

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
            oldest = msgs[-1]["id"] if msgs else 0
            reactions = [{"mid": str(r["mid"]), "pid": r["pid"], "e": r["e"]}
                         for r in self.db.execute("SELECT mid, pid, e FROM reactions WHERE mid >= ?", (oldest,))]
        return {
            "info": self._info(info),
            "players": players,
            "messages": [self._message(r) for r in reversed(msgs)],
            "activities": acts,
            "notices": notices,
            "votes": votes,
            "reactions": reactions,
        }

    def player_by_token(self, token_hash: str):
        with self.lock:
            r = self.db.execute("SELECT * FROM players WHERE token_hash = ?", (token_hash,)).fetchone()
        return self._player(r) if r else None

    def player_count(self) -> int:
        with self.lock:
            return self.db.execute("SELECT COUNT(*) AS n FROM players").fetchone()["n"]

    def codename_taken(self, codename: str, exclude_pid: str | None) -> bool:
        with self.lock:
            r = self.db.execute(
                "SELECT 1 FROM players WHERE lower(codename) = lower(?) AND (CAST(? AS TEXT) IS NULL OR id <> ?)",
                (codename, exclude_pid, exclude_pid),
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
    def upsert_player(self, token_hash: str, codename: str, emoji: int, color: int, rsvp: str | None = None) -> tuple[dict, bool]:
        """Create or update the player bound to this browser token. Returns (player, created).
        A missing rsvp leaves the current answer as it is."""
        with self.lock:
            r = self.db.execute("SELECT id FROM players WHERE token_hash = ?", (token_hash,)).fetchone()
            if r:
                self.db.execute(
                    "UPDATE players SET codename = ?, emoji = ?, color = ?, rsvp = COALESCE(?, rsvp) WHERE id = ?",
                    (codename, emoji, color, rsvp, r["id"]),
                )
                pid, created = r["id"], False
            else:
                pid, created = secrets.token_urlsafe(8), True
                self.db.execute(
                    "INSERT INTO players (id, token_hash, codename, emoji, color, joined_at, rsvp) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (pid, token_hash, codename, emoji, color, now_ms(), rsvp),
                )
            row = self.db.execute("SELECT * FROM players WHERE id = ?", (pid,)).fetchone()
        return self._player(row), created

    def set_rsvp(self, pid: str, rsvp: str) -> dict:
        with self.lock:
            self.db.execute("UPDATE players SET rsvp = ? WHERE id = ?", (rsvp, pid))
            row = self.db.execute("SELECT * FROM players WHERE id = ?", (pid,)).fetchone()
        return self._player(row)

    def add_message(self, pid: str, kind: str, text: str = "", aid: str | None = None) -> dict:
        with self.lock:
            row = self.db.execute(
                "INSERT INTO messages (pid, kind, text, aid, ts) VALUES (?, ?, ?, ?, ?) RETURNING *",
                (pid, kind, text, aid, now_ms()),
            ).fetchone()
            if row["id"] % 100 == 0:
                self.db.execute("DELETE FROM messages WHERE id <= ?", (row["id"] - KEEP,))
                self.db.execute("DELETE FROM reactions WHERE mid <= ?", (row["id"] - KEEP,))
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

    def set_reaction(self, mid: str, pid: str, e: int, on: bool) -> bool:
        """Add or take back an emoji reaction to a whisper. False if there is no such whisper."""
        if not mid.isdigit():
            return False
        with self.lock:
            if not self.db.execute("SELECT 1 FROM messages WHERE id = ? AND kind = 'msg'", (int(mid),)).fetchone():
                return False
            if on:
                self.db.execute("INSERT INTO reactions (mid, pid, e) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", (int(mid), pid, e))
            else:
                self.db.execute("DELETE FROM reactions WHERE mid = ? AND pid = ? AND e = ?", (int(mid), pid, e))
        return True

    def notice_count(self) -> int:
        with self.lock:
            return self.db.execute("SELECT COUNT(*) AS n FROM notices").fetchone()["n"]

    def add_notice(self, text: str) -> dict:
        nid = secrets.token_urlsafe(8)
        with self.lock:
            self.db.execute("INSERT INTO notices (id, text, ts) VALUES (?, ?, ?)", (nid, text, now_ms()))
            row = self.db.execute("SELECT * FROM notices WHERE id = ?", (nid,)).fetchone()
        return self._notice(row)

    def update_notice(self, nid: str, text: str):
        with self.lock:
            if self.db.execute("UPDATE notices SET text = ? WHERE id = ?", (text, nid)).rowcount == 0:
                return None
            row = self.db.execute("SELECT * FROM notices WHERE id = ?", (nid,)).fetchone()
        return self._notice(row)

    def rename_activity(self, aid: str, title: str) -> dict:
        with self.lock:
            self.db.execute("UPDATE activities SET title = ? WHERE id = ?", (title, aid))
            row = self.db.execute("SELECT * FROM activities WHERE id = ?", (aid,)).fetchone()
        return self._activity(row)

    def delete_player(self, pid: str):
        """Remove a member and their votes. Their whispers stay, unattributed. Returns their name, or None."""
        with self.lock:
            r = self.db.execute("SELECT codename FROM players WHERE id = ?", (pid,)).fetchone()
            if not r:
                return None
            self.db.execute("DELETE FROM players WHERE id = ?", (pid,))
            self.db.execute("DELETE FROM votes WHERE pid = ?", (pid,))
            self.db.execute("DELETE FROM reactions WHERE pid = ?", (pid,))
        return r["codename"]

    def delete_message(self, mid: str) -> bool:
        if not mid.isdigit():
            return False
        with self.lock:
            self.db.execute("DELETE FROM reactions WHERE mid = ?", (int(mid),))
            return self.db.execute("DELETE FROM messages WHERE id = ?", (int(mid),)).rowcount > 0

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

    def reset(self) -> None:
        """Wipe everything: members, whispers, rites, votes, notices, and the summons back to its defaults."""
        with self.lock:
            for table in ("reactions", "votes", "messages", "activities", "notices", "players", "info"):
                self.db.execute(f"DELETE FROM {table}")

    def backup(self, dest: str) -> None:
        if self.postgres:
            raise SystemExit("This copy uses Postgres. Back it up with pg_dump, or from your host's dashboard.")
        with self.lock:
            target = sqlite3.connect(dest)
            with target:
                self.db.backup(target)
            target.close()

    # ---------- row shapes sent to browsers ----------
    @staticmethod
    def _player(r) -> dict:
        return {"id": r["id"], "codename": r["codename"], "emoji": r["emoji"], "color": r["color"], "joinedAt": r["joined_at"], "rsvp": r["rsvp"]}

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
            return {"name": "", "when": DEFAULT_WHEN, "where": DEFAULT_WHERE}
        return {"name": r["name"], "when": r["when_text"], "where": r["where_text"]}

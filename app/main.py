"""Party HQ server: serves the page and runs the live chat over one WebSocket."""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import re
import time
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .store import COLOR_COUNT, EMOJI_COUNT, Store

log = logging.getLogger("party-hq")

PASSCODE = os.environ.get("PARTY_PASSCODE", "").strip()
ADMIN_CODE = os.environ.get("ADMIN_CODE", "").strip()
DB_PATH = os.environ.get("DB_PATH", "party.db")
MAX_PLAYERS = int(os.environ.get("MAX_PLAYERS", "200"))
MAX_CONNECTIONS = int(os.environ.get("MAX_CONNECTIONS", "500"))
MAX_NOTICES = 20

# The React build (web/dist). Run `npm run build` in web/ first, or use Docker.
STATIC = Path(os.environ.get("WEB_DIST", Path(__file__).resolve().parent.parent / "web" / "dist"))
TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{20,100}$")
SPACES = re.compile(r"\s+")

CSP = (
    "default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; "
    "script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; "
    "frame-ancestors 'none'; object-src 'none'"
)

store = Store(DB_PATH)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Content-Security-Policy"] = CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/")
async def index():
    return FileResponse(STATIC / "index.html", headers={"Cache-Control": "no-cache"})


@app.get("/healthz")
async def healthz():
    return JSONResponse({"ok": True})


app.mount("/assets", StaticFiles(directory=STATIC / "assets", check_dir=False), name="assets")


# ---------------------------------------------------------------------------
# Live connections
# ---------------------------------------------------------------------------

def same(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())


def clean(value, limit: int) -> str:
    return SPACES.sub(" ", value).strip()[:limit] if isinstance(value, str) else ""


class Conn:
    """One open browser tab."""

    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.authed = False
        self.token_hash: str | None = None
        self.pid: str | None = None
        self.admin = False
        self.typing = False
        self.send_lock = asyncio.Lock()
        self.tokens = 10.0            # rate-limit bucket
        self.refilled = time.monotonic()

    def spend(self, cost: float) -> bool:
        now = time.monotonic()
        self.tokens = min(10.0, self.tokens + (now - self.refilled) * 2.0)
        self.refilled = now
        if self.tokens < cost:
            return False
        self.tokens -= cost
        return True

    async def send(self, payload: dict) -> bool:
        try:
            async with self.send_lock:
                await asyncio.wait_for(self.ws.send_text(json.dumps(payload)), timeout=5)
            return True
        except Exception:
            return False


class Hub:
    def __init__(self):
        self.conns: set[Conn] = set()

    async def broadcast(self, payload: dict) -> None:
        targets = [c for c in self.conns if c.authed]
        results = await asyncio.gather(*(c.send(payload) for c in targets))
        for c, ok in zip(targets, results):
            if not ok:
                self.conns.discard(c)

    async def presence(self) -> None:
        online = sorted({c.pid for c in self.conns if c.authed and c.pid})
        typing = sorted({c.pid for c in self.conns if c.authed and c.pid and c.typing})
        await self.broadcast({"type": "presence", "online": online, "typing": typing})


hub = Hub()


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    if len(hub.conns) >= MAX_CONNECTIONS:
        await ws.close(code=1013)
        return
    conn = Conn(ws)
    hub.conns.add(conn)
    try:
        while True:
            raw = await ws.receive_text()
            if len(raw) > 4096:
                continue
            try:
                msg = json.loads(raw)
            except ValueError:
                continue
            if isinstance(msg, dict):
                await handle(conn, msg)
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("connection error")
    finally:
        hub.conns.discard(conn)
        if conn.pid:
            await hub.presence()


async def handle(conn: Conn, msg: dict) -> None:
    kind = msg.get("type")
    rid = msg.get("rid")
    rid = rid if isinstance(rid, (int, str)) and len(str(rid)) <= 20 else None

    async def ack(ok: bool = True, **extra):
        if rid is not None:
            await conn.send({"type": "ack", "rid": rid, "ok": ok, **extra})

    if kind == "hello":
        await hello(conn, msg)
        return
    if not conn.authed:
        await ack(False, error="locked")
        return

    if kind == "admin":
        code = msg.get("code")
        conn.admin = bool(ADMIN_CODE) and isinstance(code, str) and same(code, ADMIN_CODE)
        await ack(conn.admin, error=None if conn.admin else "forbidden")
        return

    if kind == "typing":
        on = msg.get("on") is True and conn.pid is not None
        if on != conn.typing:
            conn.typing = on
            await hub.presence()
        return

    if kind == "join":
        if not conn.spend(1):
            return await ack(False, error="slow")
        codename = clean(msg.get("codename"), 28)
        emoji, color = msg.get("emoji"), msg.get("color")
        if len(codename) < 2 or not isinstance(emoji, int) or not isinstance(color, int) \
                or not 0 <= emoji < EMOJI_COUNT or not 0 <= color < COLOR_COUNT:
            return await ack(False, error="invalid")
        if store.codename_taken(codename, conn.pid):
            return await ack(False, error="taken")
        if conn.pid is None and store.player_count() >= MAX_PLAYERS:
            return await ack(False, error="full")
        player, created = store.upsert_player(conn.token_hash, codename, emoji, color)
        conn.pid = player["id"]
        # Any other tabs from the same browser now belong to this player too.
        for other in hub.conns:
            if other.token_hash == conn.token_hash:
                other.pid = conn.pid
        await ack(True, you=conn.pid)
        await hub.broadcast({"type": "player", "player": player})
        if created:
            await hub.broadcast({"type": "message", "message": store.add_message(conn.pid, "join")})
        await hub.presence()
        return

    if conn.pid is None:
        return await ack(False, error="not_joined")

    if kind == "msg":
        text = msg.get("text")
        text = text.strip()[:500] if isinstance(text, str) else ""
        if not text:
            return await ack(False, error="invalid")
        if not conn.spend(1):
            return await ack(False, error="slow")
        conn.typing = False
        await hub.broadcast({"type": "message", "message": store.add_message(conn.pid, "msg", text)})
        await hub.presence()
        return await ack()

    if kind == "idea":
        title = clean(msg.get("title"), 80)
        if not title:
            return await ack(False, error="invalid")
        dup = store.activity_by_title(title)
        if dup:
            return await ack(False, error="duplicate", title=dup["title"])
        if not conn.spend(2):
            return await ack(False, error="slow")
        act = store.add_activity(title, conn.pid)
        await hub.broadcast({"type": "activity", "activity": act})
        await hub.broadcast({"type": "message", "message": store.add_message(conn.pid, "suggest", title, act["id"])})
        return await ack(True, id=act["id"])

    if kind == "remove_idea":
        act = store.activity(str(msg.get("id", "")))
        if not act:
            return await ack(False, error="gone")
        if act["pid"] != conn.pid and not conn.admin:
            return await ack(False, error="forbidden")
        store.remove_activity(act["id"])
        await hub.broadcast({"type": "activity_removed", "id": act["id"]})
        return await ack()

    if kind == "vote":
        aid, v = str(msg.get("aid", "")), msg.get("v")
        if v not in (-1, 0, 1) or isinstance(v, bool) or not store.activity(aid):
            return await ack(False, error="invalid")
        if not conn.spend(0.25):
            return await ack(False, error="slow")
        store.set_vote(conn.pid, aid, v)
        await hub.broadcast({"type": "vote", "pid": conn.pid, "aid": aid, "v": v})
        return await ack()

    if kind == "info":
        if not conn.admin:
            return await ack(False, error="forbidden")
        info = store.set_info(
            clean(msg.get("name"), 40) or "The Halloween Conclave",
            clean(msg.get("when"), 60),
            clean(msg.get("where"), 60),
        )
        await hub.broadcast({"type": "info", "info": info})
        return await ack()

    if kind == "notice":
        if not conn.admin:
            return await ack(False, error="forbidden")
        text = clean(msg.get("text"), 200)
        if not text:
            return await ack(False, error="invalid")
        if store.notice_count() >= MAX_NOTICES:
            return await ack(False, error="full")
        await hub.broadcast({"type": "notice", "notice": store.add_notice(text)})
        return await ack()

    if kind == "remove_notice":
        if not conn.admin:
            return await ack(False, error="forbidden")
        if store.remove_notice(str(msg.get("id", ""))):
            await hub.broadcast({"type": "notice_removed", "id": str(msg.get("id"))})
        return await ack()

    await ack(False, error="unknown")


async def hello(conn: Conn, msg: dict) -> None:
    token = msg.get("token")
    if not isinstance(token, str) or not TOKEN_RE.match(token):
        await conn.send({"type": "error", "error": "bad_token"})
        return
    passcode = msg.get("passcode")
    if PASSCODE and not (isinstance(passcode, str) and same(passcode.strip(), PASSCODE)):
        await conn.send({"type": "locked", "wrong": bool(passcode)})
        return
    conn.authed = True
    conn.token_hash = hashlib.sha256(token.encode()).hexdigest()
    player = store.player_by_token(conn.token_hash)
    conn.pid = player["id"] if player else None
    code = msg.get("admin")
    conn.admin = bool(ADMIN_CODE) and isinstance(code, str) and same(code, ADMIN_CODE)
    await conn.send({
        "type": "welcome",
        "you": conn.pid,
        "admin": conn.admin,
        "hasAdmin": bool(ADMIN_CODE),
        "state": store.snapshot(),
    })
    await hub.presence()

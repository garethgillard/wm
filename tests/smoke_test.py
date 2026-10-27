"""End-to-end smoke test: starts a throwaway server and drives two browsers' worth of WebSocket traffic.

Run from the repo root:
    python -m venv .venv && .venv/bin/pip install -r requirements.txt
    .venv/bin/python tests/smoke_test.py
It uses a temporary database, so it never touches your real party data.
"""

import asyncio
import json
import os
import secrets
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

import websockets

ROOT = Path(__file__).resolve().parent.parent
PASS, ADMIN = "letmein", "organiser-" + secrets.token_hex(4)


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Client:
    def __init__(self, url: str, name: str):
        self.url, self.name = url, name
        self.token = secrets.token_urlsafe(24)
        self.inbox: asyncio.Queue = asyncio.Queue()
        self.rid = 0

    async def open(self):
        self.ws = await websockets.connect(self.url)
        self.reader = asyncio.create_task(self._read())

    async def _read(self):
        async for raw in self.ws:
            await self.inbox.put(json.loads(raw))

    async def send(self, **msg):
        await self.ws.send(json.dumps(msg))

    async def expect(self, kind: str, check=lambda m: True, timeout: float = 3.0) -> dict:
        deadline = time.monotonic() + timeout
        while True:
            m = await asyncio.wait_for(self.inbox.get(), timeout=max(0.05, deadline - time.monotonic()))
            if m.get("type") == kind and check(m):
                return m

    async def request(self, kind: str, **payload) -> dict:
        self.rid += 1
        rid = self.rid
        await self.send(type=kind, rid=rid, **payload)
        return await self.expect("ack", lambda m: m.get("rid") == rid)

    async def close(self):
        await self.ws.close()
        self.reader.cancel()


def check(label: str, ok: bool):
    print(("  ok    " if ok else "  FAIL  ") + label)
    if not ok:
        raise SystemExit(1)


async def run(url: str):
    a, b = Client(url, "A"), Client(url, "B")
    await a.open()
    await b.open()

    await a.send(type="hello", token=a.token)
    check("wrong or missing passcode is refused", (await a.expect("locked"))["type"] == "locked")
    await a.send(type="hello", token=a.token, passcode=PASS)
    w = await a.expect("welcome")
    check("correct passcode lets you in", w["you"] is None and w["hasAdmin"] is True)
    await b.send(type="hello", token=b.token, passcode=PASS)
    await b.expect("welcome")

    r = await a.request("msg", text="hi")
    check("posting before picking a codename is refused", r["ok"] is False and r["error"] == "not_joined")

    r = await a.request("join", codename="Agent Test Puffin", emoji=3, color=4)
    check("A joins with a codename", r["ok"] and isinstance(r["you"], str))
    a_id = r["you"]
    p = await b.expect("player", lambda m: m["player"]["id"] == a_id)
    check("B sees A's codename live", p["player"]["codename"] == "Agent Test Puffin")
    await b.expect("message", lambda m: m["message"]["kind"] == "join")

    r = await b.request("join", codename="agent test puffin", emoji=1, color=1)
    check("duplicate codename is refused", r["ok"] is False and r["error"] == "taken")
    r = await b.request("join", codename="Neon Herring", emoji=23, color=3)
    check("B joins", r["ok"])
    b_id = r["you"]

    await a.request("msg", text="Who is ready to plan?")
    m = await b.expect("message", lambda m: m["message"]["kind"] == "msg")
    check("B receives A's chat message", m["message"]["text"] == "Who is ready to plan?" and m["message"]["pid"] == a_id)

    r = await a.request("idea", title="Karaoke night")
    check("A proposes an activity", r["ok"])
    aid = r["id"]
    await b.expect("activity", lambda m: m["activity"]["id"] == aid)
    r = await b.request("idea", title="karaoke  NIGHT")
    check("duplicate activity is refused", r["ok"] is False and r["error"] == "duplicate")

    await b.request("vote", aid=aid, v=1)
    v = await a.expect("vote", lambda m: m["pid"] == b_id)
    check("A sees B's Go vote live", v["aid"] == aid and v["v"] == 1)

    r = await b.request("edit_idea", id=aid, title="Karaoke with robes")
    check("only the proposer or organiser can rename a rite", r["ok"] is False and r["error"] == "forbidden")
    r = await a.request("edit_idea", id=aid, title="Karaoke séance")
    check("proposer renames their rite", r["ok"] is True)
    ren = await b.expect("activity", lambda m: m["activity"]["id"] == aid)
    check("B sees the new rite title live", ren["activity"]["title"] == "Karaoke séance")

    r = await b.request("remove_idea", id=aid)
    check("B can't remove A's activity", r["ok"] is False and r["error"] == "forbidden")
    r = await a.request("info", name="Julebord", when="Fri 11 Dec", where="")
    check("party details are locked without the organiser code", r["ok"] is False)
    r = await a.request("admin", code="wrong")
    check("wrong organiser code is refused", r["ok"] is False)
    r = await a.request("admin", code=ADMIN)
    check("organiser code unlocks organiser mode", r["ok"] is True)
    await a.request("info", name="Julebord", when="Fri 11 Dec", where="")
    i = await b.expect("info")
    check("B sees the new party details", i["info"]["name"] == "Julebord")

    r = await b.request("notice", text="Masks on at the door")
    check("only the organiser can post notices", r["ok"] is False and r["error"] == "forbidden")
    r = await a.request("notice", text="Masks on at the door")
    check("organiser posts a notice", r["ok"] is True)
    n = await b.expect("notice")
    check("B sees the notice live", n["notice"]["text"] == "Masks on at the door")
    r = await b.request("edit_notice", id=n["notice"]["id"], text="Hacked")
    check("only the organiser can edit notices", r["ok"] is False and r["error"] == "forbidden")
    await a.request("edit_notice", id=n["notice"]["id"], text="Masks and robes on at the door")
    e = await b.expect("notice", lambda m: m["notice"]["id"] == n["notice"]["id"] and m["notice"]["text"].startswith("Masks and"))
    check("organiser edits a notice live", e["notice"]["text"] == "Masks and robes on at the door")
    await a.request("remove_notice", id=n["notice"]["id"])
    gone = await b.expect("notice_removed")
    check("organiser removes the notice", gone["id"] == n["notice"]["id"])

    await b.send(type="typing", on=True)
    pr = await a.expect("presence", lambda m: b_id in m["typing"])
    check("typing indicator reaches A", a_id in pr["online"] and b_id in pr["online"])

    # Reconnect as A from the same browser token: identity and data survive.
    await a.close()
    a2 = Client(url, "A2")
    a2.token = a.token
    await a2.open()
    await a2.send(type="hello", token=a2.token, passcode=PASS)
    w = await a2.expect("welcome")
    st = w["state"]
    check("reconnecting keeps your codename", w["you"] == a_id)
    check("history is kept", any(m["text"] == "Who is ready to plan?" for m in st["messages"]))
    check("votes are kept", st["votes"].get(b_id, {}).get(aid) == 1)
    await a2.close()
    await b.close()


def main():
    port = free_port()
    with tempfile.TemporaryDirectory() as tmp:
        env = dict(os.environ, PARTY_PASSCODE=PASS, ADMIN_CODE=ADMIN, DB_PATH=str(Path(tmp) / "test.db"))
        server = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"],
            cwd=ROOT, env=env,
        )
        try:
            for _ in range(50):
                try:
                    urllib.request.urlopen(f"http://127.0.0.1:{port}/healthz", timeout=1)
                    break
                except Exception:
                    time.sleep(0.2)
            page = urllib.request.urlopen(f"http://127.0.0.1:{port}/")
            print("Party HQ smoke test")
            check("page loads with a strict security policy", "default-src 'self'" in page.headers.get("Content-Security-Policy", ""))
            asyncio.run(run(f"ws://127.0.0.1:{port}/ws"))
            print("All checks passed.")
        finally:
            server.terminate()
            server.wait(timeout=5)


if __name__ == "__main__":
    main()

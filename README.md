# Party HQ: The WM Cult

A live, Halloween-themed gathering room for planning a work party. First-time visitors land on a black page with the WM letters and an Enter button. Everyone takes their vows with a **secret name**, an animal **familiar** and a **robe**, whispers in the chat, and votes **Aye** or **Nay** on the proposed rites. No accounts: people open the link, pick a name and take a seat.

- **Whispers** (left): live chat with "is whispering…" and day separators
- **The ritual table** (centre): a candlelit dungeon round table where every member sits as a robed, masked figure. Their candle is lit while they are here; empty chairs wait for newcomers. Tap a figure to see its name
- **The notice board** (right): the summons (name, when, where), notices from the organiser, and the rites to vote on, ranked by ayes minus nays
- Phones: table on top, chat below, and the board drops down from the header
- Propose rites from the board or by typing `/idea Séance` in the chat
- Optional password at the door; an organiser code for you to edit any board text in place (tap it, change it, save), post notices and remove any rite
- Wiener Melange touches throughout: a coffee-bean pupil in the sigil, the founder's salmon portrait, a melange painting with a suspicious tail, and coffee beside the salmon on the table
- Everything stays on your server: SQLite database, self-hosted fonts, no third-party requests

**Stack:** React 19 + Vite for the page, Python 3.12 + FastAPI + WebSockets for the server, SQLite for storage. Docker builds both into one container.

---

## Deploy to an NREC instance: checklist

Tick these off in order. Commands run on the NREC instance unless noted.

- [ ] **1. Push this repo to GitHub** (on your laptop)
  ```bash
  git remote add origin git@github.com:<you>/party-hq.git
  git push -u origin main
  ```
- [ ] **2. Open ports 80 and 443** in the NREC dashboard: *Network → Security Groups → Manage Rules → Add Rule* (HTTP, then HTTPS). Skip if your SNP portal already serves on 80/443.
- [ ] **3. Check Docker is installed**: `docker compose version`. If not, follow Docker's install guide for Ubuntu: https://docs.docker.com/engine/install/ubuntu/
- [ ] **4. Clone the repo**
  ```bash
  git clone https://github.com/<you>/party-hq.git ~/party-hq
  cd ~/party-hq
  ```
- [ ] **5. Set your codes**
  ```bash
  cp .env.example .env
  openssl rand -base64 18      # copy the output into ADMIN_CODE
  nano .env                    # set ADMIN_CODE, and PARTY_PASSCODE if you want one
  ```
  If something else already uses port 8080 on the instance (check with `ss -ltn | grep 8080`), set `PARTY_PORT` to a free port and use that port in step 7.
- [ ] **6. Start it**
  ```bash
  docker compose up -d --build
  curl http://127.0.0.1:8080/healthz      # → {"ok":true}
  ```
- [ ] **7. Put it behind your web server with HTTPS.** Use whichever server the instance already runs. Each file has two options:
  - **Option A, its own hostname** (e.g. `party.example.org`): needs a DNS name pointing at the instance's public IP.
  - **Option B, a sub-path on a site you already have** (e.g. `https://<your-snp-portal-host>/party/`): no new DNS or certificate needed.

  nginx: [`deploy/nginx.conf`](deploy/nginx.conf) · Apache: [`deploy/apache.conf`](deploy/apache.conf). Each file lists its exact commands, including `certbot` for HTTPS.
- [ ] **8. Test it**: open the link on your phone and laptop, pick two codenames, send a message and vote. Both should update instantly.
- [ ] **9. Unlock organiser mode**: notice board → *Enter organiser code* → paste your `ADMIN_CODE`. Then tap any text on the board to change it (name, when, where, notices, rite titles) and post your notices. Edits show for everyone straight away.
- [ ] **10. Share the link** (and the passcode, if you set one) with your colleagues.

### Updating
```bash
cd ~/party-hq && git pull && docker compose up -d --build
```
Chat history, codenames and votes live in the `party-data` Docker volume and survive updates.

### Backup
```bash
docker compose exec party-hq python -m app.backup /data/backup.db
docker compose cp party-hq:/data/backup.db ./party-backup.db
```

### After the party
```bash
docker compose down -v      # stops it and deletes all chat data
```
Then remove the nginx/Apache site and close the ports if nothing else needs them.

---

## Work on it on your laptop

Two terminals, so page edits show up instantly:
```bash
# 1. the server (port 8000)
python -m venv .venv && .venv/bin/pip install -r requirements.txt
ADMIN_CODE=test .venv/bin/uvicorn app.main:app --reload --port 8000

# 2. the page (opens http://localhost:5173, forwards the live connection to port 8000)
cd web && npm install && npm run dev
```
Use a normal window and a private window to be two people at once.

Or run the whole thing exactly as it will be deployed:
```bash
cp .env.example .env
docker compose up --build        # then open http://127.0.0.1:8080
```

### Demo build
`cd web && npm run build:demo` makes `web/dist-demo/party-hq-demo.html`: one self-contained page where the other agents are simulated (organiser code `demo`). Handy for showing the idea before deploying.

## Test
```bash
cd web && npm run build && cd ..          # the server serves web/dist
.venv/bin/python tests/smoke_test.py
```
Starts a throwaway server with a temporary database and checks the password, joining, duplicate names, live chat, rites, votes, notices, organiser permissions, typing and reconnecting.

---

## Settings (`.env`)

| Setting | What it does | Default |
|---|---|---|
| `PARTY_PASSCODE` | Password needed at the door. Empty means anyone with the link gets in. | empty |
| `ADMIN_CODE` | Organiser code. Empty disables organiser mode. | empty |
| `PARTY_PORT` | Port on the instance's localhost that the web server forwards to. | `8080` |
| `MAX_PLAYERS` | Maximum number of codenames. | `200` |

## How it works

```
browser ──HTTPS──▶ nginx / Apache ──▶ party-hq container (uvicorn, 127.0.0.1:8080)
                                         ├─ GET /          page (web/dist, built React)
                                         ├─ WS  /ws        live chat, votes, presence
                                         └─ /data/party.db SQLite (Docker volume)
```

- Each browser makes a random token on first visit and keeps it in local storage. The server stores only a hash of it and links it to that person's codename. Clearing browser data means picking a new codename.
- The page keeps one WebSocket open. Every change (message, idea, vote, details) is saved to SQLite and pushed to everyone connected. On reconnect the browser gets the latest state.
- The server keeps the last 2,000 messages and sends the latest 300 to each browser.
- Inputs are length-limited, rate-limited per connection, and rendered as plain text. The page is served with a strict Content-Security-Policy (no inline scripts, no outside hosts).

## Notes

- Anyone with the link (and passcode) can post. Keep the link within the group.
- Codenames are what everyone sees. The app stores no names, emails or IP addresses and keeps no access log (your nginx/Apache logs still record visits as usual).
- Fonts: Cinzel and Spectral, self-hosted under the SIL Open Font License (see `web/src/fonts/`).

## Project layout

```
app/main.py              server: WebSocket messages, permissions, serves web/dist
app/store.py             SQLite storage
app/backup.py            database backup helper
web/src/App.jsx          page layout and the actions behind each button
web/src/components/      Header, Chat, RitualTable (the scene), Board, Sheets (pop-ups), Cult (sigil, figures, avatars)
web/src/lib/useParty.js  live data: connects, keeps state, sends requests
web/src/lib/socket.js    the real WebSocket connection
web/src/lib/demoServer.js  demo-only pretend server with simulated colleagues
web/src/styles.css       all styling (colours are tokens at the top)
deploy/                  nginx and Apache examples
tests/smoke_test.py      end-to-end test
```

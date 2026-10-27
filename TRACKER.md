# WM tracker

One step at a time. Tick each box when it's done.

## 1. Shape it in the demo
- [x] Rebuild the page in React with a demo mode (simulated colleagues)
- [x] Layout: chat left, ritual table centre, notice board right; phone drop-down board
- [x] WM Cult Halloween theme (first pass)
- [x] Rename to WM (Wiener Melange), coffee + salmon touches, WM landing page, longer phone chat
- [x] Edit board text in place while live (summons, notices, rite titles)
- [x] Attendance: Yes / Maybe / No (Yes sits at the table, Maybe in the shadows)
- [x] Cult title with sigil lockup and sigil tab icon, leaner text, gothic + animal + lab name suggestions
- [x] Minimalist chat: robe-coloured names and side rules
- [x] No masks, names fixed once taken, tap the room for a big view, no subtitle
- [x] Renounce vows, organiser moderation (delete whispers, cast out), animated figures, Friday 30 October at CIGENE
- [ ] G: post the starting notices and rites in organiser mode before sharing the link
- [ ] Further tweaks from G
- [ ] Final look over the demo on phone and desktop

## 2. Get it ready
- [x] Run `tests/smoke_test.py` against the final build
- [x] Push the repo to GitHub: https://github.com/garethgillard/wm (public)

## 2b. Render (free tier) — what's live now
- [x] Organiser "Reset everything" button
- [x] Postgres storage so data survives Render's sleeps and redeploys
- [ ] Render: create a free Postgres, set `DATABASE_URL` and `ADMIN_CODE` on the web service (README, "Running it on Render's free tier")
- [ ] Optional: UptimeRobot ping of /healthz every 5 min so it never sleeps
- [ ] Organiser mode → post notices and rites → Reset everything first if there is test data

## 3. Deploy on NREC (README checklist, steps 2–10)
- [ ] Ports 80/443 open
- [ ] `./scripts/setup.sh` (makes `.env`, builds, starts)
- [ ] nginx or Apache + HTTPS
- [ ] Tested on two devices
- [ ] Link shared with colleagues

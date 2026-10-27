# Party HQ tracker

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
- [ ] Further tweaks from G
- [ ] Final look over the demo on phone and desktop

## 2. Get it ready
- [ ] Run `tests/smoke_test.py` against the final build
- [ ] Push the repo to GitHub

## 3. Deploy on NREC (README checklist, steps 2–10)
- [ ] Ports 80/443 open
- [ ] `.env` with organiser code (and passcode if wanted)
- [ ] `docker compose up -d --build`
- [ ] nginx or Apache + HTTPS
- [ ] Tested on two devices
- [ ] Link shared with colleagues

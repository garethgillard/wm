# Party HQ tracker

One step at a time. Tick each box when it's done.

## 1. Shape it in the demo
- [x] Rebuild the page in React with a demo mode (simulated colleagues)
- [x] Layout: chat left, ritual table centre, notice board right; phone drop-down board
- [x] VM Cult Halloween theme (first pass)
- [ ] Theme details and tweaks from G
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

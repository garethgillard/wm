#!/usr/bin/env bash
# One-command setup on the NREC instance (or any Linux server with Docker).
#
#   git clone https://github.com/garethgillard/wm.git ~/wm && cd ~/wm
#   ./scripts/setup.sh                          # no door password
#   PARTY_PASSCODE=melange ./scripts/setup.sh   # with a door password
#
# Safe to run again: it keeps an existing .env and just rebuilds and restarts.
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
die() { printf '\n\033[31m%s\033[0m\n' "$*" >&2; exit 1; }

say "1/4  Checking Docker"
command -v docker >/dev/null 2>&1 || die "Docker is not installed. Install it first: https://docs.docker.com/engine/install/ubuntu/"
docker compose version >/dev/null 2>&1 || die "The Docker Compose plugin is missing. Install docker-compose-plugin, then run this again."
docker info >/dev/null 2>&1 || die "Docker is installed but this user can't use it. Try: sudo usermod -aG docker \$USER  (then log out and back in), or run with sudo."
echo "Docker is ready."

say "2/4  Settings (.env)"
if [ -f .env ]; then
  echo "Keeping your existing .env."
else
  cp .env.example .env
  if [ -n "${PARTY_PASSCODE:-}" ]; then
    sed -i "s|^PARTY_PASSCODE=.*|PARTY_PASSCODE=${PARTY_PASSCODE}|" .env
  fi
  if [ -n "${PARTY_PORT:-}" ]; then
    sed -i "s|^PARTY_PORT=.*|PARTY_PORT=${PARTY_PORT}|" .env
  fi
  chmod 600 .env
  echo "Created .env."
fi
port="$(grep -E '^PARTY_PORT=' .env | cut -d= -f2)"; port="${port:-8080}"

if ! docker compose ps --status running 2>/dev/null | grep -qw wm; then
  if (command -v ss >/dev/null && ss -ltn | grep -q ":${port} ") ; then
    die "Port ${port} is already in use on this server. Set another, e.g.  PARTY_PORT=8090 in .env, and run this again."
  fi
fi

say "3/4  Building and starting (the first build takes a few minutes)"
docker compose up -d --build

say "4/4  Checking it answers"
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${port}/healthz" >/dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
[ "${ok:-}" = 1 ] || die "It didn't answer on port ${port}. See what went wrong with:  docker compose logs --tail 50"

admin="$(grep -E '^ADMIN_CODE=' .env | cut -d= -f2)"; admin="${admin:-salmosalar}"
pass="$(grep -E '^PARTY_PASSCODE=' .env | cut -d= -f2)"
say "The WM Cult is running on http://127.0.0.1:${port}"
echo "  Organiser code: ${admin}   (keep it to yourself)"
if [ -n "$pass" ]; then echo "  Door password:  ${pass}   (share it with the faithful)"; else echo "  Door password:  none (anyone with the link can enter)"; fi
cat <<EOF

Next: put it behind your web server with HTTPS.
  nginx:  deploy/nginx.conf      Apache:  deploy/apache.conf
  (Option B serves it at /party/ on a site you already have, with no new DNS.)
Then open the link, take your vows, use the Organiser's entrance with the code above,
and post your starting notices and rites before sharing the link.

Update later:   git pull && docker compose up -d --build
Logs:           docker compose logs -f
Wipe all data:  docker compose down -v
EOF

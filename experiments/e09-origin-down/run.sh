#!/usr/bin/env bash
# What do readers see when the origin is down? Scripted, from your laptop.
#
#   ORIGIN_SSH=root@<droplet IP> CF_API_TOKEN=... CF_ZONE_ID=... experiments/e09-origin-down/run.sh
#
# Phases (each ~30 s of checks every 3 s on three URLs):
#   1 baseline      nginx up
#   2 down          nginx stopped (cached URLs should still be served)
#   3 down+purged   /colophon/ purged from the edge while nginx is still down
#   4 recovered     nginx started again
# nginx is ALWAYS restarted on exit, even if you Ctrl-C.
set -euo pipefail
: "${ORIGIN_SSH:?set ORIGIN_SSH=root@<droplet IP>}"
: "${CF_API_TOKEN:?set CF_API_TOKEN (cache purge token)}"
: "${CF_ZONE_ID:?set CF_ZONE_ID}"
SITE=${SITE:-https://thareqyusuf.com}
URLS="/ /colophon/ /__probe"
cd "$(dirname "$0")"
mkdir -p results/raw
OUT="results/raw/$(date -u +%Y-%m-%dT%H%M%SZ).csv"

restart() { ssh "$ORIGIN_SSH" 'systemctl start nginx' && echo "nginx started"; }
trap restart EXIT

check() { # phase
  for _ in $(seq 10); do
    for u in $URLS; do
      line=$(curl -s -o /dev/null -D - -w 'STATUS %{http_code} %{time_total}\n' "$SITE$u" | tr -d '\r')
      code=$(echo "$line" | awk '/^STATUS/{print $2}'); t=$(echo "$line" | awk '/^STATUS/{print $3}')
      cache=$(echo "$line" | awk -F': ' 'tolower($1)=="cf-cache-status"{print $2}')
      echo "$(date -u +%T),$1,$u,$code,${cache:-none},$t" | tee -a "$OUT"
    done
    sleep 3
  done
}

echo "time,phase,path,status,cache,seconds" > "$OUT"
for u in $URLS; do curl -s -o /dev/null "$SITE$u"; done   # warm the edge
check baseline
ssh "$ORIGIN_SSH" 'systemctl stop nginx' && echo "nginx stopped"
check down
curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
  --data "{\"files\":[\"$SITE/colophon/\"]}" >/dev/null && echo "purged /colophon/"
sleep 5
check down+purged
restart; trap - EXIT
sleep 3
check recovered
echo "raw: experiments/e09-origin-down/$OUT"
echo "summary: node experiments/e09-origin-down/summarize.mjs experiments/e09-origin-down/$OUT"

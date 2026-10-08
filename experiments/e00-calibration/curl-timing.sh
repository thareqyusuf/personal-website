#!/usr/bin/env bash
# Time N fresh requests (new connection each) from YOUR machine with curl's own phase timers.
#   experiments/e00-calibration/curl-timing.sh 20 > experiments/e00-calibration/results/raw/curl-$(date -u +%Y-%m-%dT%H%M%SZ).csv
# Columns are curl's cumulative timers in seconds (dns ≤ connect ≤ appconnect ≤ starttransfer ≤ total).
set -euo pipefail
N=${1:-20}
SITE=${SITE:-https://thareqyusuf.com}
hdr=$(mktemp); trap 'rm -f "$hdr"' EXIT
echo "path,i,http,dns,connect,appconnect,starttransfer,total,cache,pop"
for path in / /__probe; do
  for i in $(seq "$N"); do
    # No query string: it would change the cache key and turn every request into a MISS.
    t=$(curl -s -o /dev/null -D "$hdr" -w '%{http_version},%{time_namelookup},%{time_connect},%{time_appconnect},%{time_starttransfer},%{time_total}' "$SITE$path")
    cache=$(grep -i '^cf-cache-status:' "$hdr" | awk '{print $2}' | tr -d '\r')
    pop=$(grep -i '^cf-ray:' "$hdr" | awk -F- '{print $NF}' | tr -d '\r')
    echo "$path,$i,$t,${cache:-none},${pop:-none}"
    sleep 0.5
  done
done

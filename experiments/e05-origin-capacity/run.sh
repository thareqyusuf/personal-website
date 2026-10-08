#!/usr/bin/env bash
# Run ON THE DROPLET. Steps through request rates for each path, 60 s per step, with vmstat alongside.
# Stops climbing a path once p99 > 50 ms, errors > 1 %, or k6 itself can't keep up (dropped iterations).
#
#   ./run.sh                                   default rates and paths
#   RATES="500 1000 2000" PATHS="/" ./run.sh   custom
set -euo pipefail
cd "$(dirname "$0")"

RATES=${RATES:-"250 500 1000 2000 4000 8000 16000"}
PATHS=${PATHS:-"/ /fonts/archivo-v1.woff2 /__probe"}
DURATION=${DURATION:-60s}
OUT="results/$(date -u +%Y-%m-%dT%H%M%SZ)"
mkdir -p "$OUT"

{
  echo "started=$(date -u +%FT%TZ)"
  echo "nginx=$(nginx -v 2>&1)"
  echo "k6=$(k6 version | head -1)"
  echo "kernel=$(uname -r)"
  echo "cpus=$(nproc)"
  echo "mem=$(free -m | awk '/Mem:/{print $2" MB"}')"
  echo "release=$(readlink /srv/site/current)"
} > "$OUT/context.txt"

for path in $PATHS; do
  slug=$(echo "$path" | tr '/.' '__')
  for rate in $RATES; do
    echo "== $path at $rate req/s"
    vmstat 1 > "$OUT/vmstat${slug}_${rate}.txt" &
    VM=$!
    k6 run --quiet -e RATE="$rate" -e DURATION="$DURATION" -e URL="http://127.0.0.1:8081$path" \
      -e OUT="$OUT/k6${slug}_${rate}.json" load.js || true
    kill "$VM" 2>/dev/null || true
    f="$OUT/k6${slug}_${rate}.json"
    p99=$(jq -r '.data.metrics.http_req_duration.values["p(99)"] // 0' "$f")
    err=$(jq -r '.data.metrics.http_req_failed.values.rate // 0' "$f")
    drop=$(jq -r '.data.metrics.dropped_iterations.values.count // 0' "$f")
    echo "   p99=${p99} ms  errors=${err}  dropped=${drop}"
    if jq -e --argjson p "$p99" --argjson e "$err" --argjson d "$drop" -n '$p > 50 or $e > 0.01 or $d > 0' >/dev/null; then
      echo "   stopping $path here (past the knee, or k6 is the bottleneck)"
      break
    fi
    sleep 15   # let TIME_WAIT sockets and CPU settle between steps
  done
done
echo "Done: $OUT  (copy it to your laptop, see README)"

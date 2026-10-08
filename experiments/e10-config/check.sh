#!/usr/bin/env bash
# Is the live serving config what the repo says it is? Run from your laptop.
#   ORIGIN_IP=<droplet IP> experiments/e10-config/check.sh
# Writes data/lab/e10/<stamp>.json (origin IP never written) and exits non-zero on any FAIL.
set -uo pipefail
SITE=${SITE:-https://thareqyusuf.com}
HOST=${SITE#https://}
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
rows=(); fails=0

rec() { # check, expected, got, PASS|FAIL|SKIP
  printf '%-4s  %-46s expected: %-38s got: %s\n' "$4" "$1" "$2" "$3"
  [ "$4" = FAIL ] && fails=$((fails+1))
  esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }
  rows+=("[\"$(esc "$1")\",\"$(esc "$2")\",\"$(esc "$3")\",\"$4\"]")
}
hdr() { curl -s -o /dev/null -D - "$@" | tr -d '\r'; }
get() { echo "$1" | awk -v k="$(echo "$2" | tr A-Z a-z)" -F': ' 'tolower($1)==k{print $2; exit}'; }
code() { echo "$1" | awk 'NR==1{print $2}'; }

H=$(hdr "$SITE/")
[ "$(code "$H")" = 200 ] && rec "home page" "200" "$(code "$H")" PASS || rec "home page" "200" "$(code "$H")" FAIL
cc=$(get "$H" cache-control); [[ "$cc" == *"s-maxage=604800"* ]] && rec "HTML cache-control" "s-maxage=604800" "$cc" PASS || rec "HTML cache-control" "s-maxage=604800" "$cc" FAIL
[ -n "$(get "$H" content-security-policy)" ] && rec "CSP header" "present" "present" PASS || rec "CSP header" "present" "missing" FAIL
[ -n "$(get "$H" strict-transport-security)" ] && rec "HSTS header" "present" "present" PASS || rec "HSTS header" "present" "missing" FAIL
alt=$(get "$H" alt-svc); [[ "$alt" == *h3* ]] && rec "HTTP/3 advertised (alt-svc)" "h3" "$alt" PASS || rec "HTTP/3 advertised (alt-svc)" "h3" "${alt:-none}" FAIL
st=$(get "$H" server-timing); rec "Server-Timing cfL4 (footer's best RTT source)" "cfL4 (informational)" "${st:-none}" "$([[ "$st" == *cfL4* ]] && echo PASS || echo SKIP)"

css=$(curl -s "$SITE/" | grep -o 'href=/css/[^ >]*\.css\|href="/css/[^"]*\.css' | head -1 | sed 's/href=//; s/"//g')
if [ -n "$css" ]; then C=$(hdr "$SITE$css"); cc=$(get "$C" cache-control)
  [[ "$cc" == *immutable* ]] && rec "fingerprinted CSS" "immutable" "$cc" PASS || rec "fingerprinted CSS" "immutable" "$cc" FAIL
else rec "fingerprinted CSS" "found in page" "not found" FAIL; fi
F=$(hdr "$SITE/fonts/archivo-v1.woff2"); [[ "$(get "$F" cache-control)" == *immutable* ]] && rec "font" "immutable" "$(get "$F" cache-control)" PASS || rec "font" "immutable" "$(get "$F" cache-control)" FAIL
R=$(hdr "$SITE/index.xml"); [[ "$(get "$R" content-type)" == application/rss+xml* ]] && rec "RSS content-type" "application/rss+xml" "$(get "$R" content-type)" PASS || rec "RSS content-type" "application/rss+xml" "$(get "$R" content-type)" FAIL
P1=$(hdr "$SITE/__probe"); P2=$(hdr "$SITE/__probe"); s2=$(get "$P2" cf-cache-status)
[[ "$(get "$P1" cache-control)" == no-store ]] && rec "/__probe cache-control" "no-store" "$(get "$P1" cache-control)" PASS || rec "/__probe cache-control" "no-store" "$(get "$P1" cache-control)" FAIL
[ "$s2" != HIT ] && rec "/__probe never cached (2nd request)" "not HIT" "${s2:-none}" PASS || rec "/__probe never cached (2nd request)" "not HIT" "$s2" FAIL
N=$(hdr "$SITE/definitely-not-a-page/"); [ "$(code "$N")" = 404 ] && rec "unknown path" "404" "$(code "$N")" PASS || rec "unknown path" "404" "$(code "$N")" FAIL
W=$(hdr "https://www.$HOST/x"); loc=$(get "$W" location)
[ "$loc" = "$SITE/x" ] && rec "www redirects to bare domain" "$SITE/x" "$loc" PASS || rec "www redirects to bare domain" "$SITE/x" "${loc:-none}" FAIL
P=$(hdr "http://$HOST/"); [[ "$(code "$P")" =~ ^30[178]$ && "$(get "$P" location)" == https://* ]] && rec "http → https" "30x to https" "$(code "$P") $(get "$P" location)" PASS || rec "http → https" "30x to https" "$(code "$P")" FAIL
if curl -s -o /dev/null --tlsv1.1 --tls-max 1.1 "$SITE/" 2>/dev/null; then rec "TLS 1.1 refused" "handshake fails" "accepted" FAIL; else rec "TLS 1.1 refused" "handshake fails" "refused" PASS; fi
if curl -V | grep -q HTTP3; then v=$(curl -s -o /dev/null -w '%{http_version}' --http3-only "$SITE/"); [ "$v" = 3 ] && rec "HTTP/3 request" "3" "$v" PASS || rec "HTTP/3 request" "3" "$v" FAIL
else rec "HTTP/3 request" "3" "this curl has no HTTP/3" SKIP; fi
if [ -n "${ORIGIN_IP:-}" ]; then
  o=$(curl -sk -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 8 "https://$ORIGIN_IP/" 2>/dev/null); o=${o:-000}
  [ "$o" = 000 ] && rec "origin unreachable directly (firewall)" "no connection" "no connection" PASS || rec "origin unreachable directly (firewall)" "no connection" "HTTP $o" FAIL
  o=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 8 --resolve "$HOST:443:$ORIGIN_IP" "https://$HOST/" 2>/dev/null); o=${o:-000}
  [ "$o" = 000 ] && rec "origin with real SNI, no client cert" "no connection" "no connection" PASS || rec "origin with real SNI, no client cert" "no connection" "HTTP $o" FAIL
else rec "origin lockdown" "set ORIGIN_IP to test" "not tested" SKIP; fi

mkdir -p "$ROOT/data/lab/e10"
{
  printf '{\n  "id": "e10",\n  "title": "Serving config checks",\n  "run_at": "%s",\n  "tool": "curl from a laptop",\n' "$(date -u +%FT%TZ)"
  printf '  "notes": ["%s failing checks.", "TLS grade: run https://www.ssllabs.com/ssltest/ on %s and add the grade here by hand."],\n' "$fails" "$HOST"
  printf '  "tables": [{"caption": "Each check, what the repo says should happen, and what the live site did.", "columns": ["Check", "Expected", "Got", "Result"], "rows": [\n    '
  first=1; for r in "${rows[@]}"; do [ $first = 1 ] && first=0 || printf ',\n    '; printf '%s' "$r"; done
  printf '\n  ]}]\n}\n'
} > "$ROOT/data/lab/e10/$STAMP.json"
echo; echo "$fails failing. Summary: data/lab/e10/$STAMP.json"
exit $((fails > 0))

#!/usr/bin/env bash
# Post-build checks. Usage: scripts/check.sh [public-dir]
# Runs in CI after `hugo`; run it locally before pushing anything structural.
set -euo pipefail
cd "$(dirname "$0")/.."
PUB=${1:-public}
fail=0
say() { printf '%-8s %s\n' "$1" "$2"; }

[ -f "$PUB/index.html" ] || { say FAIL "no $PUB/index.html — run hugo first"; exit 1; }

# 1. Feeds are well-formed XML and non-empty.
for f in index.xml blog/index.xml research/index.xml; do
  if python3 - "$PUB/$f" <<'EOF'
import sys, xml.dom.minidom as m
d = m.parse(sys.argv[1]); n = len(d.getElementsByTagName("item"))
sys.exit(0 if n > 0 else 1)
EOF
  then say ok "feed $f"; else say FAIL "feed $f invalid or empty"; fail=1; fi
done

# 2. Weight budgets. The whole point of a fast site is that it stays small.
css=$(find "$PUB/css" -name '*.css' -exec cat {} + | wc -c)
js=$(find "$PUB/js" -name '*.js' -exec cat {} + | wc -c)
html=$(wc -c < "$PUB/index.html")
[ "$css"  -le 20000 ] && say ok "css $css B (budget 20 kB)"   || { say FAIL "css $css B > 20 kB"; fail=1; }
[ "$js"   -le 12000 ] && say ok "js $js B (budget 12 kB)"     || { say FAIL "js $js B > 12 kB"; fail=1; }
[ "$html" -le 30000 ] && say ok "home html $html B (budget 30 kB)" || { say FAIL "home html $html B > 30 kB"; fail=1; }

# 3. No third-party requests except giscus.
bad=$(grep -rhoE 'src="?https?://[^" >]+' "$PUB" --include='*.html' | grep -vE 'giscus\.app' || true)
[ -z "$bad" ] && say ok "no third-party scripts/images" || { say FAIL "third-party src: $bad"; fail=1; }

# 4. The probe markup is on every HTML page.
missing=$(grep -rLE 'class="?probe[" >]' "$PUB" --include='*.html' | grep -v '/404.html' || true)
[ -z "$missing" ] && say ok "probe footer on every page" || { say FAIL "no probe in: $missing"; fail=1; }

# 5. Unfinished placeholders (warn only; they're expected until you fill them in).
todo=$(grep -rlE 'TODO|example\.com' content hugo.toml 2>/dev/null | tr '\n' ' ' || true)
[ -z "$todo" ] && say ok "no TODO placeholders" || say warn "placeholders left in: $todo"

# 6. nginx accepts the location rules (only if nginx is installed).
if command -v nginx >/dev/null; then
  if scripts/serve-nginx.sh --test "$PUB" >/dev/null 2>&1; then say ok "nginx -t on site-locations.conf"
  else say FAIL "nginx -t failed: run scripts/serve-nginx.sh --test $PUB"; fail=1; fi
fi

exit $fail

#!/usr/bin/env bash
# Serve a built site with the *production* nginx location rules on http://localhost:8080.
# Useful for checking cache headers and the /__probe endpoint, which `hugo server` doesn't have.
#
#   scripts/serve-nginx.sh [public-dir]          # foreground, Ctrl-C to stop
#   scripts/serve-nginx.sh --test [public-dir]   # just `nginx -t`
set -euo pipefail
cd "$(dirname "$0")/.."
TEST=0; [ "${1:-}" = "--test" ] && { TEST=1; shift; }
PUB=$(cd "${1:-public}" && pwd)

PREFIX=$(mktemp -d)
trap 'rm -rf "$PREFIX"' EXIT
mkdir -p "$PREFIX/snippets" "$PREFIX/logs"
cp deploy/nginx/snippets/*.conf "$PREFIX/snippets/"
sed "s#__ROOT__#$PUB#" deploy/nginx/local-test.conf > "$PREFIX/site.conf"
MIME=/etc/nginx/mime.types; [ -f "$MIME" ] || MIME=$(dirname "$(command -v nginx)")/../conf/mime.types

cat > "$PREFIX/nginx.conf" <<EOF
worker_processes 1;
error_log $PREFIX/logs/error.log warn;
pid $PREFIX/nginx.pid;
events { worker_connections 256; }
http {
  include $MIME;
  default_type application/octet-stream;
  access_log $PREFIX/logs/access.log;
  sendfile on;
  include $PREFIX/site.conf;
}
EOF

if [ $TEST = 1 ]; then exec nginx -t -p "$PREFIX" -c "$PREFIX/nginx.conf"; fi
echo "serving $PUB on http://localhost:8080 with deploy/nginx rules (Ctrl-C to stop)"
nginx -p "$PREFIX" -c "$PREFIX/nginx.conf" -g 'daemon off;'

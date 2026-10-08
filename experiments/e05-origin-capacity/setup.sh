#!/usr/bin/env bash
# Run ON THE DROPLET as root, from the folder you copied over (see README).
# Installs k6 and jq, and enables the loopback-only nginx listener on 127.0.0.1:8081.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v k6 >/dev/null; then
  curl -fsSL https://dl.k6.io/key.gpg | gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" > /etc/apt/sources.list.d/k6.list
  apt-get update -q
fi
apt-get install -y -q k6 jq >/dev/null

install -m 0644 loopback.conf /etc/nginx/conf.d/loopback.conf
nginx -t && systemctl reload nginx

curl -fsS -o /dev/null -w "loopback listener: HTTP %{http_code} in %{time_total}s\n" -H "Host: thareqyusuf.com" http://127.0.0.1:8081/
k6 version
echo "Ready. Next: ./run.sh   (and ./teardown.sh when done)"

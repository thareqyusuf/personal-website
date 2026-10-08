#!/usr/bin/env bash
# Run ON THE DROPLET. Removes the loopback listener. k6 stays installed (apt remove k6 if you like).
set -euo pipefail
rm -f /etc/nginx/conf.d/loopback.conf
nginx -t && systemctl reload nginx
echo "loopback listener removed"

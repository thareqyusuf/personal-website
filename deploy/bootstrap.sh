#!/usr/bin/env bash
# One-time setup for a fresh Ubuntu 24.04 / Debian 12+ VPS. Run as root from a checkout of this repo:
#
#   sudo DEPLOY_PUBKEY="ssh-ed25519 AAAA... github-actions" ./deploy/bootstrap.sh
#
# Before running, put the Cloudflare files in place (see deploy/CLOUDFLARE.md):
#   /etc/ssl/cloudflare/origin.pem, origin.key, authenticated_origin_pull_ca.pem
set -euo pipefail
cd "$(dirname "$0")"

: "${DEPLOY_PUBKEY:?set DEPLOY_PUBKEY to the public half of the CI deploy key}"

for f in origin.pem origin.key authenticated_origin_pull_ca.pem; do
  [ -f "/etc/ssl/cloudflare/$f" ] || { echo "missing /etc/ssl/cloudflare/$f (see deploy/CLOUDFLARE.md)" >&2; exit 1; }
done
chmod 600 /etc/ssl/cloudflare/origin.key

# --- packages: nginx from nginx.org (distro 1.24 lacks `http2 on`) ----------------------
. /etc/os-release
apt-get update -q
apt-get install -y -q curl gnupg2 ca-certificates lsb-release ufw rsync
curl -fsS https://nginx.org/keys/nginx_signing.key | gpg --dearmor -o /usr/share/keyrings/nginx-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/${ID} ${VERSION_CODENAME} nginx" \
  > /etc/apt/sources.list.d/nginx.list
printf 'Package: *\nPin: origin nginx.org\nPin-Priority: 900\n' > /etc/apt/preferences.d/99nginx
apt-get update -q
apt-get install -y -q nginx
command -v rrsync >/dev/null || { echo "rrsync not found (rsync >= 3.2.4 ships it)" >&2; exit 1; }

# --- deploy user and directory layout ---------------------------------------------------
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/sh deploy
install -d -o deploy -g deploy -m 0755 /srv/site /srv/site/releases
install -m 0755 bin/site-activate    /usr/local/bin/site-activate
install -m 0755 bin/site-deploy-gate /usr/local/bin/site-deploy-gate

# Placeholder release so nginx has something to serve before the first deploy.
if [ ! -e /srv/site/current ]; then
  install -d -o deploy -g deploy /srv/site/releases/0000000
  echo '<!doctype html><title>soon</title><p>First deploy pending.' > /srv/site/releases/0000000/index.html
  chown deploy:deploy /srv/site/releases/0000000/index.html
  sudo -u deploy /usr/local/bin/site-activate 0000000
fi

install -d -o deploy -g deploy -m 0700 /home/deploy/.ssh
echo "command=\"/usr/local/bin/site-deploy-gate\",restrict ${DEPLOY_PUBKEY}" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys

# --- nginx config -----------------------------------------------------------------------
install -d /etc/nginx/snippets
install -m 0644 nginx/snippets/site-locations.conf   /etc/nginx/snippets/
install -m 0644 nginx/snippets/security-headers.conf /etc/nginx/snippets/
install -m 0644 nginx/site.conf /etc/nginx/conf.d/site.conf
rm -f /etc/nginx/conf.d/default.conf
touch /etc/nginx/snippets/cloudflare-realip.conf   # filled in by cf-ips.sh below

# --- firewall: ssh from anywhere, 443 from Cloudflare only, 80 closed -------------------
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
install -m 0755 cf-ips.sh /usr/local/sbin/cf-ips
ufw --force enable
systemctl enable --now nginx
/usr/local/sbin/cf-ips          # writes realip snippet, opens 443 to CF ranges, reloads nginx

# Refresh Cloudflare ranges weekly.
cat > /etc/systemd/system/cf-ips.service <<'EOF'
[Unit]
Description=Refresh Cloudflare IP ranges for nginx real_ip and ufw
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/cf-ips
EOF
cat > /etc/systemd/system/cf-ips.timer <<'EOF'
[Unit]
Description=Weekly Cloudflare IP refresh
[Timer]
OnCalendar=weekly
RandomizedDelaySec=6h
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now cf-ips.timer

echo
echo "Done. Next: add the GitHub secrets listed in deploy/CLOUDFLARE.md and push to main."
echo "Host key for DEPLOY_KNOWN_HOSTS:"
ssh-keyscan -t ed25519 localhost 2>/dev/null | sed "s/^localhost/$(curl -fsS -4 ifconfig.me 2>/dev/null || echo YOUR_IP)/"

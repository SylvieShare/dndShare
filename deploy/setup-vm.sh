#!/usr/bin/env bash
# One-time Go VM setup. A service account needs Lockbox payloadViewer access.
set -euo pipefail
APP_USER="sylvieshare"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
apt-get update -y
apt-get install -y jq curl nginx certbot python3-certbot-nginx
id "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
install -m 750 -o "$APP_USER" -g "$APP_USER" "$SCRIPT_DIR/dndshare-run.sh" "/home/$APP_USER/dndshare-run.sh"
install -m 750 -o "$APP_USER" -g "$APP_USER" "$SCRIPT_DIR/fetch-secrets.sh" "/home/$APP_USER/fetch-secrets.sh"
install -m 644 "$SCRIPT_DIR/dndshare.service" /etc/systemd/system/dndshare.service
mkdir -p /var/www/dndshare-acme
if [ -s /etc/letsencrypt/live/dndshare.ru/fullchain.pem ]; then
  install -m 644 "$SCRIPT_DIR/nginx-dndshare.conf" /etc/nginx/sites-available/dndshare
else
  cat > /etc/nginx/sites-available/dndshare <<'NGINX'
server {
  listen 80;
  listen [::]:80;
  server_name dndshare.ru www.dndshare.ru;
  location /.well-known/acme-challenge/ { root /var/www/dndshare-acme; }
  location / { return 503 "DnD Share setup in progress\n"; }
}
NGINX
fi
ln -sfn /etc/nginx/sites-available/dndshare /etc/nginx/sites-enabled/dndshare
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx
systemctl daemon-reload
systemctl enable dndshare
apt-get clean
printf 'VM ready. Issue the HTTPS certificate before deploy: certbot certonly --webroot -w /var/www/dndshare-acme -d dndshare.ru -d www.dndshare.ru\n'

#!/usr/bin/env bash
# One-time Go VM setup with an external Yandex Cloud service account key.
set -euo pipefail
APP_USER="sylvieshare"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
apt-get update -y
apt-get install -y curl ca-certificates openssl python3 nginx certbot python3-certbot-nginx ufw
id "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
if [ -n "${1:-}" ]; then
  ssh-keygen -lf "$1" >/dev/null
  touch "/home/$APP_USER/.ssh/authorized_keys"
  while IFS= read -r public_key; do
    grep -Fxq "$public_key" "/home/$APP_USER/.ssh/authorized_keys" || printf '%s\n' "$public_key" >> "/home/$APP_USER/.ssh/authorized_keys"
  done < "$1"
  chown "$APP_USER:$APP_USER" "/home/$APP_USER/.ssh/authorized_keys"
  chmod 600 "/home/$APP_USER/.ssh/authorized_keys"
fi
printf '%s ALL=(ALL) NOPASSWD: ALL\n' "$APP_USER" > "/etc/sudoers.d/$APP_USER"
chmod 440 "/etc/sudoers.d/$APP_USER"
visudo -cf "/etc/sudoers.d/$APP_USER"
install -d -m 750 -o root -g "$APP_USER" /etc/dndshare
curl -fsSL --retry 3 https://storage.yandexcloud.net/cloud-certs/CA.pem -o /etc/ssl/certs/yandex-cloud-ca.pem
chmod 644 /etc/ssl/certs/yandex-cloud-ca.pem
install -m 750 -o "$APP_USER" -g "$APP_USER" "$SCRIPT_DIR/dndshare-run.sh" "/home/$APP_USER/dndshare-run.sh"
install -m 750 -o "$APP_USER" -g "$APP_USER" "$SCRIPT_DIR/fetch-secrets.sh" "/home/$APP_USER/fetch-secrets.sh"
install -m 750 -o "$APP_USER" -g "$APP_USER" "$SCRIPT_DIR/fetch-secrets.py" "/home/$APP_USER/fetch-secrets.py"
install -m 644 "$SCRIPT_DIR/dndshare.service" /etc/systemd/system/dndshare.service
mkdir -p /var/www/dndshare-acme
if [ -s /etc/letsencrypt/live/dndshare.ru/fullchain.pem ]; then
  install -m 644 "$SCRIPT_DIR/nginx-dndshare.conf" /etc/nginx/sites-available/dndshare
else
  install -m 644 "$SCRIPT_DIR/nginx-dndshare-http.conf" /etc/nginx/sites-available/dndshare
fi
ln -sfn /etc/nginx/sites-available/dndshare /etc/nginx/sites-enabled/dndshare
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx
systemctl daemon-reload
systemctl enable dndshare
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
apt-get clean
printf 'VM ready. Install /etc/dndshare/lockbox-sa-key.json (root:sylvieshare, 640), then deploy. After DNS points here, issue HTTPS: certbot certonly --webroot -w /var/www/dndshare-acme -d dndshare.ru -d www.dndshare.ru\n'

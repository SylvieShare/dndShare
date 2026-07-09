#!/usr/bin/env bash
#
# Одноразовая настройка YC-виртуалки. Запускать на VM с sudo:
#   sudo ./setup-vm.sh
# Linux-пользователь (логин и сервис) — sylvieshare. К VM должен быть привязан
# YC service account с ролью lockbox.payloadViewer на секрете dndshare-secrets
# (это IAM облака, не OS-пользователь).
#
set -euo pipefail

APP_USER="sylvieshare"

echo "==> Зависимости (JDK 21, jq, curl, yc CLI)"
apt-get update -y
apt-get install -y openjdk-21-jre-headless jq curl
# yc CLI (если ещё нет) — опционально, fetch-secrets.sh умеет и без него (raw API)
command -v yc >/dev/null 2>&1 || curl -sSL https://storage.yandexcloud.net/yandexcloud-yc/install.sh | bash || true

echo "==> Пользователь $APP_USER"
id "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"

echo "==> Установка run.sh + fetch-secrets.sh в домашку $APP_USER (разово, при деплое не копируются)"
install -m 750 -o "$APP_USER" -g "$APP_USER" "$(dirname "$0")/run.sh"          "/home/$APP_USER/run.sh"
install -m 750 -o "$APP_USER" -g "$APP_USER" "$(dirname "$0")/fetch-secrets.sh" "/home/$APP_USER/fetch-secrets.sh"

echo "==> Установка systemd-unit"
install -m 644 "$(dirname "$0")/dndshare.service" /etc/systemd/system/dndshare.service
systemctl daemon-reload
systemctl enable dndshare

echo "==> Готово. Деплой: ./deploy/deploy_mac.sh (scp только jar, systemctl restart)."

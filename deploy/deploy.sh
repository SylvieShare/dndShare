#!/usr/bin/env bash
#
# Сборка единого бинаря (Vue-фронт вшит в Go-бинарь через go:embed) + деплой на
# YC-виртуалку через systemd. Секреты тянутся из Lockbox НА VM при каждом старте
# (dndshare-run.sh). Запуск из любого cwd: ./deploy/deploy.sh
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VM_USER="${VM_USER:-sylvieshare}"
VM_HOST="${VM_HOST:-213.165.196.171}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/dndshare}"
FRONTEND_DIR="${FRONTEND_DIR:-$ROOT_DIR/frontend}"

export PATH="$PATH:/usr/local/go/bin:$HOME/go/bin"
GO="${GO:-go}"
command -v "$GO" >/dev/null 2>&1 || GO=/usr/local/go/bin/go
command -v "$GO" >/dev/null 2>&1 || { echo "ОШИБКА: Go не найден. Задай GO=/path/to/go" >&2; exit 1; }

echo "==> Сборка фронта ($FRONTEND_DIR)"
(
  cd "$FRONTEND_DIR"
  # node_modules не коммитим — ставим зависимости, если их нет (иначе `vite: command not found`).
  if [ ! -x node_modules/.bin/vite ]; then
    if [ -f package-lock.json ]; then npm ci; else npm install; fi
  fi
  npm run build
)

echo "==> Вшиваем собранный фронт в бинарь (internal/assets/dist)"
# vite build кладёт результат в frontend/target/dist (см. vite.config.js outDir).
rm -rf internal/assets/dist
mkdir -p internal/assets/dist
cp -R "$FRONTEND_DIR/target/dist/." internal/assets/dist/
# Сохраняем отслеживаемый плейсхолдер для чистого состояния Git после деплоя.
printf '\n' > internal/assets/dist/.gitkeep

echo "==> Кросс-компиляция статического бинаря (linux/amd64)"
mkdir -p build
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$GO" build -trimpath -ldflags="-s -w" -o build/dndshare .
ls -lh build/dndshare | awk '{print "    бинарь:", $5}'

echo "==> Копирование бинаря + unit + run.sh на $VM_HOST"
# .new + mv на VM — чтобы не ловить 'text file busy' при перезаписи работающего бинаря.
scp -i "$SSH_KEY" build/dndshare            "$VM_USER@$VM_HOST:~/dndshare.new"
scp -i "$SSH_KEY" deploy/dndshare.service   "$VM_USER@$VM_HOST:~/dndshare.service"
scp -i "$SSH_KEY" deploy/dndshare-run.sh    "$VM_USER@$VM_HOST:~/dndshare-run.sh"

echo "==> Обновление unit + перезапуск сервиса (секреты подтянутся в run.sh)"
ssh -i "$SSH_KEY" -t "$VM_USER@$VM_HOST" '
  set -e
  chmod +x ~/dndshare.new ~/dndshare-run.sh ~/fetch-secrets.sh
  mv ~/dndshare.new ~/dndshare
  sudo install -m 644 ~/dndshare.service /etc/systemd/system/dndshare.service
  sudo systemctl daemon-reload
  sudo systemctl restart dndshare
  sleep 3
  sudo systemctl --no-pager --lines=20 status dndshare || true
  echo "----- последние строки ~/dndshare-log.txt (вывод Go-приложения) -----"
  tail -n 40 ~/dndshare-log.txt 2>/dev/null || echo "(dndshare-log.txt пуст/нет)"
'
echo "==> Done"

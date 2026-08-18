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
BUILD_COMMIT="$(git rev-parse HEAD)"
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$GO" build -trimpath \
  -ldflags="-s -w -X dndshare/internal/web.BuildCommit=$BUILD_COMMIT" \
  -o build/dndshare .
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$GO" build -trimpath \
  -ldflags="-s -w" \
  -o build/session-image-sync ./cmd/system-image-sync
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$GO" build -trimpath \
  -ldflags="-s -w" \
  -o build/race-image-sync ./cmd/race-image-sync
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$GO" build -trimpath \
  -ldflags="-s -w" \
  -o build/race-icon-sync ./cmd/race-icon-sync
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$GO" build -trimpath \
  -ldflags="-s -w" \
  -o build/class-image-sync ./cmd/class-image-sync
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$GO" build -trimpath \
  -ldflags="-s -w" \
  -o build/spell-rune-sync ./cmd/spell-rune-sync
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$GO" build -trimpath \
  -ldflags="-s -w" \
  -o build/item-cover-sync ./cmd/item-cover-sync
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$GO" build -trimpath \
  -ldflags="-s -w" \
  -o build/bestiary-image-sync ./cmd/bestiary-image-sync
ls -lh build/dndshare | awk '{print "    бинарь:", $5}'
ls -lh build/session-image-sync | awk '{print "    синхронизация изображений:", $5}'
ls -lh build/race-image-sync | awk '{print "    изображения рас:", $5}'
ls -lh build/race-icon-sync | awk '{print "    иконки рас:", $5}'
ls -lh build/class-image-sync | awk '{print "    изображения классов:", $5}'
ls -lh build/spell-rune-sync | awk '{print "    руны заклинаний:", $5}'
ls -lh build/item-cover-sync | awk '{print "    обложки предметов:", $5}'
ls -lh build/bestiary-image-sync | awk '{print "    миграция изображений бестиария:", $5}'

echo "==> Копирование бинаря + unit + run.sh на $VM_HOST"
# .new + mv на VM — чтобы не ловить 'text file busy' при перезаписи работающего бинаря.
scp -i "$SSH_KEY" build/dndshare            "$VM_USER@$VM_HOST:~/dndshare.new"
scp -i "$SSH_KEY" build/session-image-sync  "$VM_USER@$VM_HOST:~/session-image-sync.new"
scp -i "$SSH_KEY" build/race-image-sync     "$VM_USER@$VM_HOST:~/race-image-sync.new"
scp -i "$SSH_KEY" build/race-icon-sync      "$VM_USER@$VM_HOST:~/race-icon-sync.new"
scp -i "$SSH_KEY" build/class-image-sync    "$VM_USER@$VM_HOST:~/class-image-sync.new"
scp -i "$SSH_KEY" build/spell-rune-sync     "$VM_USER@$VM_HOST:~/spell-rune-sync.new"
scp -i "$SSH_KEY" build/item-cover-sync     "$VM_USER@$VM_HOST:~/item-cover-sync.new"
scp -i "$SSH_KEY" build/bestiary-image-sync "$VM_USER@$VM_HOST:~/bestiary-image-sync.new"
scp -i "$SSH_KEY" deploy/dndshare.service   "$VM_USER@$VM_HOST:~/dndshare.service"
scp -i "$SSH_KEY" deploy/dndshare-run.sh    "$VM_USER@$VM_HOST:~/dndshare-run.sh"

echo "==> Обновление unit + перезапуск сервиса (секреты подтянутся в run.sh)"
ssh -i "$SSH_KEY" "$VM_USER@$VM_HOST" "bash -s -- '$BUILD_COMMIT'" <<'REMOTE'
  set -e
  expected_commit="$1"
  chmod +x ~/dndshare.new ~/session-image-sync.new ~/race-image-sync.new ~/race-icon-sync.new ~/class-image-sync.new ~/spell-rune-sync.new ~/item-cover-sync.new ~/bestiary-image-sync.new ~/dndshare-run.sh ~/fetch-secrets.sh
  while IFS= read -r unit_line; do
    case "$unit_line" in
      Environment=*) export "${unit_line#Environment=}" ;;
    esac
  done < ~/dndshare.service
  ~/fetch-secrets.sh dndshare-secrets ~/dndshare.env
  set -a
  source ~/dndshare.env
  set +a
  ~/bestiary-image-sync.new
  ~/race-image-sync.new
  ~/race-icon-sync.new
  ~/class-image-sync.new
  ~/spell-rune-sync.new
  ~/item-cover-sync.new
  sudo systemctl stop dndshare || true
  ~/session-image-sync.new
  mv ~/session-image-sync.new ~/session-image-sync
  mv ~/race-image-sync.new ~/race-image-sync
  mv ~/race-icon-sync.new ~/race-icon-sync
  mv ~/class-image-sync.new ~/class-image-sync
  mv ~/spell-rune-sync.new ~/spell-rune-sync
  mv ~/item-cover-sync.new ~/item-cover-sync
  mv ~/bestiary-image-sync.new ~/bestiary-image-sync
  mv ~/dndshare.new ~/dndshare
  sudo install -m 644 ~/dndshare.service /etc/systemd/system/dndshare.service
  sudo systemctl daemon-reload
  sudo systemctl restart dndshare
  ready=false
  health=''
  for _ in $(seq 1 30); do
    health="$(curl -fsS --max-time 2 http://127.0.0.1:8080/api/health 2>/dev/null || true)"
    if printf '%s' "$health" | grep -Fq '"status":"ok"' \
      && printf '%s' "$health" | grep -Fq "\"commitSha\":\"$expected_commit\""; then
      ready=true
      break
    fi
    sleep 1
  done
  if [ "$ready" != true ]; then
    echo "ОШИБКА: readiness не подтвердил commit $expected_commit; последний ответ: ${health:-<пусто>}" >&2
    sudo systemctl --no-pager --lines=30 status dndshare || true
    tail -n 60 ~/dndshare-log.txt 2>/dev/null || true
    exit 1
  fi
  echo "readiness OK: $health"
  sudo systemctl --no-pager --lines=20 status dndshare || true
  echo "----- последние строки ~/dndshare-log.txt (вывод Go-приложения) -----"
  tail -n 40 ~/dndshare-log.txt 2>/dev/null || echo "(dndshare-log.txt пуст/нет)"
REMOTE
echo "==> Done"

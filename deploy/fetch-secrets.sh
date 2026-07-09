#!/usr/bin/env bash
#
# Тянет секреты из Yandex Lockbox и пишет их в env-файл для приложения.
# Запускается НА YC-виртуалке (у неё привязан сервисный аккаунт с ролью
# lockbox.payloadViewer на секрете). Секреты не покидают облако — на dev-машину не попадают.
#
# Использование на VM:
#   ./fetch-secrets.sh dndshare-secrets ~/dndshare.env
#
set -euo pipefail

SECRET_NAME="${1:-dndshare-secrets}"
OUT_FILE="${2:-$HOME/dndshare.env}"

# Вариант A — через yc CLI (на VM с привязанным SA авторизуется сам через metadata).
if command -v yc >/dev/null 2>&1; then
  yc lockbox payload get --name "$SECRET_NAME" --format json \
    | jq -r '.entries[] | "\(.key)=\(.text_value // .textValue)"' > "$OUT_FILE"
else
  # Вариант B — без yc/только curl+jq: IAM-токен и folder из метаданных + Lockbox API.
  META="http://169.254.169.254/computeMetadata/v1"
  HDR="Metadata-Flavor: Google"
  IAM_TOKEN=$(curl -s -H "$HDR" "$META/instance/service-accounts/default/token" | jq -r .access_token)
  if [ -z "$IAM_TOKEN" ] || [ "$IAM_TOKEN" = "null" ]; then
    echo "ОШИБКА: нет IAM-токена из метаданных. К VM не привязан сервисный аккаунт." >&2
    exit 1
  fi
  # Если задан LOCKBOX_SECRET_ID — читаем payload напрямую (хватает lockbox.payloadViewer).
  # Иначе резолвим по имени через list (нужна ещё lockbox.viewer на folder).
  SECRET_ID="${LOCKBOX_SECRET_ID:-}"
  if [ -z "$SECRET_ID" ]; then
    FOLDER_ID="${YC_FOLDER_ID:-$(curl -s -H "$HDR" "$META/yandex/folder-id")}"
    SECRET_ID=$(curl -s -H "Authorization: Bearer $IAM_TOKEN" \
      "https://lockbox.api.cloud.yandex.net/lockbox/v1/secrets?folderId=${FOLDER_ID}" \
      | jq -r ".secrets[]? | select(.name==\"$SECRET_NAME\") | .id")
  fi
  if [ -z "$SECRET_ID" ] || [ "$SECRET_ID" = "null" ]; then
    echo "ОШИБКА: секрет не найден. Укажи LOCKBOX_SECRET_ID=<id> (нужна роль lockbox.payloadViewer на секрете)," >&2
    echo "       либо дай SA роль lockbox.viewer на folder для поиска по имени '$SECRET_NAME'." >&2
    exit 1
  fi
  curl -s -H "Authorization: Bearer $IAM_TOKEN" \
    "https://payload.lockbox.api.cloud.yandex.net/lockbox/v1/secrets/${SECRET_ID}/payload" \
    | jq -r '.entries[] | "\(.key)=\(.textValue)"' > "$OUT_FILE"
fi

chmod 600 "$OUT_FILE"
echo "Secrets written to $OUT_FILE ($(wc -l < "$OUT_FILE") keys)"

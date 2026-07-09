#!/usr/bin/env bash
#
# Wrapper для systemd ExecStart: тянет секреты из Lockbox, грузит в env, запускает бинарь.
# exec заменяет shell на приложение — systemd следит именно за процессом dndshare.
#
set -euo pipefail

SECRET_NAME="${SECRET_NAME:-dndshare-secrets}"
ENV_FILE="$HOME/dndshare.env"

# Свежие секреты на каждый (пере)запуск (fetch-secrets.sh — общий, тянет DB_PASSWORD,
# OBJECT_STORAGE_*, MCP_* из Lockbox).
"$HOME/fetch-secrets.sh" "$SECRET_NAME" "$ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

exec "$HOME/dndshare"

#!/usr/bin/env bash
#
# Wrapper для systemd ExecStart: тянет секреты из Lockbox, грузит в env, запускает бинарь.
# exec заменяет shell на приложение — systemd следит именно за процессом dndshare.
#
set -euo pipefail

ENV_FILE="$HOME/dndshare.env"
db_url="${DB_URL:?DB_URL must be set by systemd}"
db_user="${DB_USER:?DB_USER must be set by systemd}"
secure_cookie="${SESSION_SECURE_COOKIE:?SESSION_SECURE_COOKIE must be set by systemd}"

# Свежие секреты на каждый (пере)запуск (fetch-secrets.sh — общий, тянет DB_PASSWORD,
# OBJECT_STORAGE_*, MCP_* из Lockbox).
"$HOME/fetch-secrets.sh" "$ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
# Infrastructure settings from the unit take precedence over old Lockbox entries.
export DB_URL="$db_url" DB_USER="$db_user" SESSION_SECURE_COOKIE="$secure_cookie"

exec "$HOME/dndshare"

#!/usr/bin/env bash
set -euo pipefail

readonly db_host="rc1a-53oq8gi7zdrgmy2u.mdb.yandexcloud.net"
readonly db_port="6432"
readonly db_name="sylvieshare"
readonly db_user="codex"
readonly keychain_service="dndshare-postgres-mcp"

db_password="$(/usr/bin/security find-generic-password \
  -a "$db_user" \
  -s "$keychain_service" \
  -w)"

encoded_password="$(PGPASSWORD="$db_password" /usr/bin/python3 -c \
  'import os, urllib.parse; print(urllib.parse.quote(os.environ["PGPASSWORD"], safe=""))')"
unset db_password

export DATABASE_URI="postgresql://${db_user}:${encoded_password}@${db_host}:${db_port}/${db_name}?sslmode=require"
unset encoded_password

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
exec uvx \
  --with 'mcp[cli]<2' \
  'postgres-mcp==0.3.0' \
  --access-mode=restricted \
  --transport=stdio

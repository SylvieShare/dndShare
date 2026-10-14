#!/usr/bin/env bash
# Получает Lockbox payload прямо на VM по LOCKBOX_SECRET_ID.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/fetch-secrets.py" "${1:-$HOME/dndshare.env}"

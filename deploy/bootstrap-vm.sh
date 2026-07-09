#!/usr/bin/env bash
#
# Запускать НА Mac (один раз). Копирует deploy/ на VM и выполняет setup-vm.sh там.
# Требует: SSH-доступ к VM по ключу, sudo у пользователя на VM.
#
#   VM_HOST=<ip> ./deploy/bootstrap-vm.sh
#
set -euo pipefail

# Папка deploy/ — там, где лежит этот скрипт (работает из любой cwd).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VM_USER="${VM_USER:-sylvieshare}"
VM_HOST="${VM_HOST:-213.165.196.171}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/dndshare}"

echo "==> Копирую deploy/ на $VM_USER@$VM_HOST"
scp -i "$SSH_KEY" -r "$SCRIPT_DIR" "$VM_USER@$VM_HOST:~/"

echo "==> Выполняю setup-vm.sh на VM (sudo)"
ssh -i "$SSH_KEY" -t "$VM_USER@$VM_HOST" 'sudo bash ~/deploy/setup-vm.sh'

echo "==> Готово. Теперь деплой: VM_HOST=$VM_HOST ./deploy/deploy_mac.sh"

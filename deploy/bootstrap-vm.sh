#!/usr/bin/env bash
#
# Запускать НА Mac (один раз). Копирует deploy/ на VM и выполняет setup-vm.sh там.
# Требует: SSH-доступ к VM по ключу, root или sudo у bootstrap-пользователя.
#
#   VM_HOST=<ip> ./deploy/bootstrap-vm.sh
#
set -euo pipefail

# Папка deploy/ — там, где лежит этот скрипт (работает из любой cwd).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

VM_USER="${VM_USER:-root}"
VM_HOST="${VM_HOST:-72.56.16.183}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/dndshare}"
test -r "$SSH_KEY.pub" || { echo "Нет публичного SSH-ключа: $SSH_KEY.pub" >&2; exit 1; }

echo "==> Копирую deploy/ на $VM_USER@$VM_HOST"
scp -i "$SSH_KEY" -r "$SCRIPT_DIR" "$VM_USER@$VM_HOST:~/"
scp -i "$SSH_KEY" "$SSH_KEY.pub" "$VM_USER@$VM_HOST:~/dndshare-bootstrap.pub"

echo "==> Выполняю setup-vm.sh на VM (sudo)"
ssh -i "$SSH_KEY" "$VM_USER@$VM_HOST" 'sudo -n bash ~/deploy/setup-vm.sh ~/dndshare-bootstrap.pub && rm ~/dndshare-bootstrap.pub'

echo "==> Готово. Теперь деплой: VM_HOST=$VM_HOST ./deploy/deploy.sh"

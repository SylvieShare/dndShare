#!/usr/bin/env bash
# Prepare one immutable bundle, then publish it over a single SCP connection.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$ROOT_DIR"

VM_USER="${VM_USER:-sylvieshare}"
VM_HOST="${VM_HOST:-72.56.16.183}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/dndshare}"
target="$VM_USER@$VM_HOST"
ssh_bin="${DNDSHARE_RELEASE_SSH:-ssh}"
scp_bin="${DNDSHARE_RELEASE_SCP:-scp}"
ssh_options=(-i "$SSH_KEY" -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=3)
frontend="$ROOT_DIR/frontend"
output="$ROOT_DIR/build/web-release"

require_clean() {
  local status
  status="$(git status --porcelain --untracked-files=all)"
  [[ -z "$status" ]] ||
    { echo 'Release requires a clean checkout.' >&2; exit 1; }
}

frontend_checksums() (
  cd "$frontend/target/dist"
  find . -type f -print0 | sort -z | xargs -0 sha256sum
)

cleanup_upload() {
  "$ssh_bin" "${ssh_options[@]}" "$target" "rm -f -- '$DEPLOY_DIR/release.tar.gz'; rmdir -- '$DEPLOY_DIR'" >/dev/null 2>&1 || true
}

prepare() {
  require_clean
  local commit started assets archive_hash
  commit="$(git rev-parse HEAD)"
  started="$SECONDS"
  mkdir -p "$output"
  rm -f -- "$output/manifest"
  export PATH="$PATH:/usr/local/go/bin:$HOME/go/bin"
  local go_bin="${GO:-go}"
  command -v "$go_bin" >/dev/null 2>&1 || go_bin=/usr/local/go/bin/go

  echo "==> Сборка веба и Go ($commit)"
  (
    cd "$frontend"
    if [[ ! -f node_modules/.bin/vite ]]; then npm ci; fi
    npm run build
  )
  frontend_checksums > "$output/frontend.sha256"

  assets="$ROOT_DIR/internal/assets/dist"
  if [[ -e "$assets" || -L "$assets" ]]; then
    [[ -d "$assets" && "$(cd "$assets" && pwd -P)" == "$assets" ]] ||
      { echo 'Invalid embed directory.' >&2; exit 1; }
    rm -rf -- "$assets"
  fi
  mkdir -p "$assets"
  printf '\n' > "$assets/.gitkeep"
  cp -R "$frontend/target/dist/." "$assets/"
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$go_bin" build -trimpath \
    -ldflags="-s -w -X dndshare/internal/web.BuildCommit=$commit" \
    -o "$output/dndshare.new" .

  # Keep old hashed assets available to open tabs. The transfer also includes
  # the service configuration, but it uses just one compressed archive.
  COPYFILE_DISABLE=1 tar -czf "$output/release.tar.gz" \
    -C "$output" dndshare.new \
    -C "$frontend/target/dist" static \
    -C "$ROOT_DIR/deploy" dndshare.service dndshare-run.sh fetch-secrets.sh fetch-secrets.py \
    nginx-dndshare.conf nginx-dndshare-http.conf journald-storage.conf certbot-reload-nginx.sh
  archive_hash="$(sha256sum "$output/release.tar.gz" | awk '{print $1}')"
  require_clean
  [[ "$(git rev-parse HEAD)" == "$commit" ]] || { echo 'HEAD changed during build.' >&2; exit 1; }
  printf '%s %s\n' "$commit" "$archive_hash" > "$output/manifest"
  echo "==> Архив готов за $((SECONDS - started)) с, $(wc -c < "$output/release.tar.gz") байт"
}

publish() {
  require_clean
  local commit archive_hash staging before started
  read -r commit archive_hash < "$output/manifest" ||
    { echo 'Run deploy.sh --prepare first.' >&2; exit 1; }
  [[ "$commit" =~ ^[0-9a-f]{40}$ && "$commit" == "$(git rev-parse HEAD)" && "$archive_hash" =~ ^[0-9a-f]{64}$ ]] ||
    { echo 'Prepared release does not match HEAD.' >&2; exit 1; }
  if git show-ref --verify --quiet refs/remotes/origin/main; then
    git merge-base --is-ancestor origin/main "$commit" ||
      { echo 'Release is older than origin/main.' >&2; exit 1; }
  fi
  printf '%s  %s\n' "$archive_hash" "$output/release.tar.gz" | sha256sum -c -
  frontend_checksums | cmp -s "$output/frontend.sha256" - ||
    { echo 'Frontend output changed after preparation; rebuild and recheck.' >&2; exit 1; }

  started="$SECONDS"
  staging="$("$ssh_bin" "${ssh_options[@]}" "$target" 'bash -s' <<'REMOTE'
set -euo pipefail
available_bytes=$(df -PB1 "$HOME" | awk 'NR==2 {print $4}')
[[ "$available_bytes" -ge 268435456 ]] || { echo 'Need at least 256 MiB free on the VM.' >&2; exit 1; }
health="$(curl -fsS --max-time 2 http://127.0.0.1:8080/api/health 2>/dev/null || true)"
before=''
if [[ "$health" == *'"status":"ok"'* ]]; then
  before="$(sed -n 's/.*"commitSha":"\([0-9a-f]\{40\}\)".*/\1/p' <<< "$health")"
fi
printf '%s %s\n' "$(mktemp -d "$HOME/dndshare-deploy.XXXXXX")" "${before:-none}"
REMOTE
)"
  read -r DEPLOY_DIR before <<< "$staging"
  [[ "$DEPLOY_DIR" =~ ^/[a-zA-Z0-9_./-]+/dndshare-deploy\.[a-zA-Z0-9]+$ && "$before" =~ ^(none|[0-9a-f]{40})$ ]] ||
    { echo 'Invalid remote staging response.' >&2; exit 1; }

  # Until activation begins, the uploader owns staging cleanup.
  trap cleanup_upload EXIT
  echo "==> Передача сжатого архива на $VM_HOST"
  "$scp_bin" "${ssh_options[@]}" "$output/release.tar.gz" "$target:$DEPLOY_DIR/release.tar.gz"
  echo "==> Передача завершена за $((SECONDS - started)) с"
  trap - EXIT
  "$ssh_bin" "${ssh_options[@]}" "$target" "bash -s -- install '$commit' '$DEPLOY_DIR' '$archive_hash' '$before'" \
    < "$ROOT_DIR/deploy/activate-release.sh"
}

case "${1:-}" in
  '') prepare; publish ;;
  --prepare) prepare ;;
  --publish) publish ;;
  --rollback) "$ssh_bin" "${ssh_options[@]}" "$target" 'bash -s -- rollback' < "$ROOT_DIR/deploy/activate-release.sh" ;;
  *) echo "Usage: $0 [--prepare | --publish | --rollback]" >&2; exit 2 ;;
esac

#!/usr/bin/env bash
# Runs on the VM under the same lock for both installation and rollback.
set -euo pipefail

release_root="$HOME"
stage=''
runtime_files=(dndshare dndshare-run.sh fetch-secrets.sh fetch-secrets.py)
valid_stage() {
  local suffix="${stage#"$release_root"/dndshare-deploy.}"
  [[ "$suffix" =~ ^[a-zA-Z0-9]+$ && -d "$stage" &&
     ! -L "$stage" && "$(cd "$stage" && pwd -P)" == "$stage" ]]
}
cleanup() {
  if valid_stage; then
    rm -rf -- "$stage"
  fi
}

health_commit() {
  local health
  health="$(curl -fsS --max-time 2 http://127.0.0.1:8080/api/health 2>/dev/null || true)"
  if [[ "$health" == *'"status":"ok"'* ]]; then
    sed -n 's/.*"commitSha":"\([0-9a-f]\{40\}\)".*/\1/p' <<< "$health"
  fi
}

wait_ready() {
  local expected="$1"
  for _ in $(seq 1 30); do
    if [[ "$(health_commit)" == "$expected" ]]; then
      echo "readiness OK: $expected"
      return
    fi
    sleep 1
  done
  echo "Readiness did not confirm $expected." >&2
  sudo systemctl --no-pager --lines=20 status dndshare || true
  tail -n 30 "$release_root/dndshare-log.txt" 2>/dev/null || true
  return 1
}

save_previous() {
  local commit="$1"
  mkdir "$stage/previous"
  printf '%s\n' "$commit" > "$stage/previous/commit"
  (cd "$release_root"; sha256sum "${runtime_files[@]}") > "$stage/previous/binary.sha256"
  tar -cf "$stage/previous.tar" -C "$stage/previous" commit binary.sha256 -C "$release_root" "${runtime_files[@]}"
  mv -f -- "$stage/previous.tar" "$release_root/dndshare-previous.tar"
}

install_release() {
  local commit="$1" archive_hash="$3" before="$4" current asset_cache nginx_conf
  stage="$2"
  [[ "$commit" =~ ^[0-9a-f]{40}$ && "$archive_hash" =~ ^[0-9a-f]{64}$ ]] &&
    valid_stage || { echo 'Invalid release arguments.' >&2; exit 1; }
  cd "$stage"
  printf '%s  release.tar.gz\n' "$archive_hash" | sha256sum -c -
  current="$(health_commit)"
  if [[ "${current:-none}" != "$before" ]]; then
    echo 'The active commit changed during transfer. Check main and prepare a fresh rollout.' >&2
    exit 1
  fi
  tar -xzf release.tar.gz
  if [[ "$(od -An -N4 -tx1 dndshare.new | tr -d ' \n')" != 7f454c46 ]]; then
    echo 'Release does not contain a Linux executable.' >&2
    exit 1
  fi
  chmod +x ./dndshare.new ./dndshare-run.sh ./fetch-secrets.sh

  # Validate secrets and publish complete immutable assets while the old
  # server is still running. The runtime fetches current secrets on startup.
  while IFS= read -r unit_line; do
    case "$unit_line" in Environment=*) export "${unit_line#Environment=}" ;; esac
  done < ./dndshare.service
  ./fetch-secrets.sh "$release_root/dndshare.env"
  asset_cache="$release_root/dndshare-frontend-assets/static"
  mkdir -p "$asset_cache"
  cp -aln static/. "$asset_cache/"

  sudo install -d -m 755 /etc/letsencrypt/renewal-hooks/deploy /etc/systemd/journald.conf.d
  sudo install -m 750 ./certbot-reload-nginx.sh /etc/letsencrypt/renewal-hooks/deploy/dndshare-nginx
  if ! sudo cmp -s ./journald-storage.conf /etc/systemd/journald.conf.d/60-dndshare-storage.conf; then
    sudo install -m 644 ./journald-storage.conf /etc/systemd/journald.conf.d/60-dndshare-storage.conf
    sudo systemctl restart systemd-journald
  fi
  sudo install -m 644 ./dndshare.service /etc/systemd/system/dndshare.service
  nginx_conf=./nginx-dndshare-http.conf
  if sudo test -s /etc/letsencrypt/live/dndshare.ru/fullchain.pem; then
    nginx_conf=./nginx-dndshare.conf
  fi
  sudo install -m 644 "$nginx_conf" /etc/nginx/sites-available/dndshare
  sudo ln -sfn /etc/nginx/sites-available/dndshare /etc/nginx/sites-enabled/dndshare
  sudo nginx -t
  sudo systemctl reload nginx
  sudo systemctl daemon-reload

  if [[ -n "$current" && "$current" != "$commit" && -f "$release_root/dndshare" ]]; then
    save_previous "$current"
  fi
  sudo systemctl stop dndshare
  mv -f -- ./dndshare.new "$release_root/dndshare"
  mv -f -- ./dndshare-run.sh ./fetch-secrets.sh ./fetch-secrets.py "$release_root/"
  mv -f -- ./nginx-dndshare.conf "$release_root/dndshare-nginx.conf"
  mv -f -- ./nginx-dndshare-http.conf "$release_root/dndshare-nginx-http.conf"
  mv -f -- ./dndshare.service ./journald-storage.conf ./certbot-reload-nginx.sh "$release_root/"
  sudo systemctl restart dndshare
  wait_ready "$commit"
}

rollback_release() {
  local previous
  [[ -f "$release_root/dndshare-previous.tar" ]] || { echo 'No healthy previous release has been saved.' >&2; exit 1; }
  stage="$(mktemp -d "$release_root/dndshare-deploy.XXXXXX")"
  cd "$stage"
  tar -xf "$release_root/dndshare-previous.tar"
  previous="$(cat commit)"
  [[ "$previous" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid rollback commit.' >&2; exit 1; }
  sha256sum -c binary.sha256
  if [[ "$(health_commit)" == "$previous" ]]; then
    echo "Already serving $previous"
    return
  fi
  for file in "${runtime_files[@]}"; do
    [[ -f "$file" ]] || { echo "Incomplete rollback snapshot: $file" >&2; exit 1; }
  done
  chmod +x dndshare dndshare-run.sh fetch-secrets.sh
  sudo systemctl stop dndshare
  mv -f -- "${runtime_files[@]}" "$release_root/"
  sudo systemctl reset-failed dndshare
  sudo systemctl restart dndshare
  wait_ready "$previous"
}

trap cleanup EXIT
exec 9>"$release_root/.dndshare-deploy.lock"
flock -w 300 9
case "${1:-}" in
  install) shift; install_release "$@" ;;
  rollback) rollback_release ;;
  *) exit 2 ;;
esac

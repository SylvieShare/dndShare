#!/usr/bin/env bash
# Remote blue-green controller. Only a healthy candidate may replace the live slot.
set -Eeuo pipefail
release_root="${DNDSHARE_DEPLOY_HOME:-$HOME}"
root="$release_root/dndshare-deployment"
system_root="${DNDSHARE_SYSTEM_ROOT:-/etc}"
upstream="$system_root/nginx/conf.d/dndshare-upstream.conf"
site="$system_root/nginx/sites-available/dndshare"
stage='' old_slot='' target_slot='' old_commit='' old_previous=''
switched=false
finished=false
candidate_started=false

slot_port() { case "$1" in blue|legacy) echo 8080 ;; green) echo 8081 ;; *) return 1 ;; esac; }
unit_name() { [[ "$1" == legacy ]] && echo dndshare || echo "dndshare@$1"; }
active_slot() {
  if [[ -f "$root/active" ]]; then cat "$root/active"; else echo legacy; fi
}
health_commit() {
  local health
  health="$(curl -fsS --max-time 2 "http://127.0.0.1:$1/api/health" 2>/dev/null || true)"
  if [[ "$health" == *'"status":"ok"'* ]]; then
    sed -n 's/.*"commitSha":"\([0-9a-f]\{40\}\)".*/\1/p' <<< "$health"
  fi
}
wait_ready() {
  local port="$1" expected="$2"
  for _ in $(seq 1 "${DNDSHARE_READY_ATTEMPTS:-30}"); do
    if [[ "$(health_commit "$port")" == "$expected" ]]; then echo "readiness OK: $expected on $port"; return 0; fi
    sleep 1
  done
  echo "Candidate $expected on $port failed readiness." >&2
  return 1
}
atomic_text() { printf '%s\n' "$2" > "$1.next"; mv -f -- "$1.next" "$1"; }
write_slot_env() {
  printf 'PORT=%s\nDEPLOYMENT_CANDIDATE=%s\n' "$(slot_port "$1")" "$2" > "$root/$1.env.next"
  chmod 600 "$root/$1.env.next"
  mv -f -- "$root/$1.env.next" "$root/$1.env"
}
set_upstream() {
  printf 'upstream dndshare_backend { server 127.0.0.1:%s; }\n' "$(slot_port "$1")" > "$stage/upstream.next"
  sudo install -m 644 "$stage/upstream.next" "$upstream.next"
  sudo mv -f -- "$upstream.next" "$upstream"
}
proxy_ready() {
  local expected="$1" health
  for _ in $(seq 1 "${DNDSHARE_PROXY_ATTEMPTS:-15}"); do
    if sudo test -s "$system_root/letsencrypt/live/dndshare.ru/fullchain.pem"; then
      health="$(curl -fsS --max-time 3 --resolve dndshare.ru:443:127.0.0.1 https://dndshare.ru/api/health 2>/dev/null || true)"
    else
      health="$(curl -fsS --max-time 3 -H 'Host: dndshare.ru' http://127.0.0.1/api/health 2>/dev/null || true)"
    fi
    [[ "$health" == *'"status":"ok"'* && "$health" == *"\"commitSha\":\"$expected\""* ]] && return 0
    sleep 1
  done
  echo 'Nginx did not confirm the candidate release.' >&2
  return 1
}
valid_stage() {
  local suffix="${stage#"$release_root"/dndshare-deploy.}"
  [[ "$suffix" =~ ^[a-zA-Z0-9]+$ && -d "$stage" && ! -L "$stage" && "$(cd "$stage" && pwd -P)" == "$stage" ]]
}
cleanup() { if valid_stage; then rm -rf -- "$stage"; fi; }
restore() {
  local code="$?"
  if [[ "$code" == 0 ]]; then code=1; fi
  trap - ERR HUP INT TERM
  set +e
  if [[ "$finished" != true && "$candidate_started" == true ]]; then
    echo 'Rollout failed; restoring the previous healthy process.' >&2
    if [[ "$switched" == true && -n "$old_commit" ]]; then
      local restarted=false
      if ! sudo systemctl is-active --quiet "$(unit_name "$old_slot")"; then
        restarted=true
        if [[ "$old_slot" == legacy ]]; then
          # A legacy binary has no candidate gate. Stop any possibly activated
          # candidate before its boot-time recovery can inspect RUNNING jobs.
          sudo systemctl stop "$(unit_name "$target_slot")"
        else write_slot_env "$old_slot" true; fi
      fi
      sudo systemctl start "$(unit_name "$old_slot")"
      if ! wait_ready "$(slot_port "$old_slot")" "$old_commit"; then
        echo 'The previous process cannot recover; leaving the candidate running for diagnosis.' >&2
        exit "$code"
      fi
      sudo install -m 644 "$stage/previous-upstream" "$upstream"
      sudo install -m 644 "$stage/previous-site" "$site"
      if ! sudo nginx -t || ! sudo systemctl reload nginx; then
        echo 'Cannot restore nginx; leaving both processes running.' >&2
        exit "$code"
      fi
      if [[ "$old_slot" == legacy ]]; then rm -f -- "$root/active"; else atomic_text "$root/active" "$old_slot"; fi
      atomic_text "$root/previous" "$old_previous"
      sudo systemctl stop "$(unit_name "$target_slot")"
      if [[ "$restarted" == true && "$old_slot" != legacy ]]; then
        write_slot_env "$old_slot" false
        curl -fsS --max-time 15 -X POST "http://127.0.0.1:$(slot_port "$old_slot")/internal/deployment/activate?commit=$old_commit" > /dev/null
      fi
      sudo systemctl enable "$(unit_name "$old_slot")"
    fi
    sudo systemctl stop "$(unit_name "$target_slot")"
    sudo systemctl disable "$(unit_name "$target_slot")"
  fi
  exit "${code:-1}"
}

switch_release() {
  local commit="$1" directory="$2" port
  candidate_started=false
  switched=false
  finished=false
  old_slot="$(active_slot)"
  old_commit="$(health_commit "$(slot_port "$old_slot")")"
  old_previous="$(cat "$root/previous" 2>/dev/null || true)"
  if [[ -z "$target_slot" ]]; then
    [[ "$old_slot" == green ]] && target_slot=blue || target_slot=green
  fi
  [[ "$target_slot" == blue || "$target_slot" == green ]] && [[ "$target_slot" != "$old_slot" ]]
  port="$(slot_port "$target_slot")"
  sudo systemctl stop "$(unit_name "$target_slot")"
  ln -sfn -- "$directory" "$root/slots/$target_slot"
  write_slot_env "$target_slot" true
  sudo systemctl reset-failed "$(unit_name "$target_slot")" || true
  candidate_started=true
  sudo systemctl start "$(unit_name "$target_slot")"
  wait_ready "$port" "$commit"

  if sudo test -f "$upstream"; then sudo cp "$upstream" "$stage/previous-upstream";
  else printf 'upstream dndshare_backend { server 127.0.0.1:8080; }\n' > "$stage/previous-upstream"; fi
  sudo cp "$site" "$stage/previous-site"
  local nginx_conf="$directory/nginx-dndshare-http.conf"
  if sudo test -s "$system_root/letsencrypt/live/dndshare.ru/fullchain.pem"; then nginx_conf="$directory/nginx-dndshare.conf"; fi
  switched=true
  set_upstream "$target_slot"
  sudo install -m 644 "$nginx_conf" "$site"
  sudo nginx -t
  sudo systemctl reload nginx
  proxy_ready "$commit"

  # SIGTERM closes SSE, drains requests and cancels cooperative jobs. No global
  # orphan recovery is allowed until the previous process has actually exited.
  if [[ -n "$old_commit" ]] || sudo systemctl is-active --quiet "$(unit_name "$old_slot")"; then
    sudo systemctl stop "$(unit_name "$old_slot")"
    sudo systemctl disable "$(unit_name "$old_slot")" || true
  fi
  write_slot_env "$target_slot" false
  atomic_text "$root/active" "$target_slot"
  if [[ "$old_slot" == legacy || -z "$old_commit" ]]; then atomic_text "$root/previous" '';
  else atomic_text "$root/previous" "$old_slot"; fi
  sudo systemctl enable "$(unit_name "$target_slot")"
  curl -fsS --max-time 15 -X POST "http://127.0.0.1:$port/internal/deployment/activate?commit=$commit" > /dev/null
  finished=true
  echo "Active slot: $target_slot ($commit). Previous: ${old_slot}."
}

install_release() {
  local commit="$1" archive_hash="$3" before="$4" current directory
  stage="$2"
  [[ "$commit" =~ ^[0-9a-f]{40}$ && "$archive_hash" =~ ^[0-9a-f]{64}$ ]] && valid_stage
  current="$(health_commit "$(slot_port "$(active_slot)")")"
  [[ "${current:-none}" == "$before" ]] || { echo 'Active release changed during transfer.' >&2; return 1; }
  cd "$stage"
  printf '%s  release.tar.gz\n' "$archive_hash" | sha256sum -c -
  tar -xzf release.tar.gz
  [[ "$(od -An -N4 -tx1 dndshare.new | tr -d ' \n')" == 7f454c46 ]]
  chmod +x dndshare.new dndshare-run.sh fetch-secrets.sh
  while IFS= read -r unit_line; do case "$unit_line" in Environment=*) export "${unit_line#Environment=}" ;; esac; done < dndshare.service
  ./fetch-secrets.sh "$stage/validated.env"
  mkdir -p "$root/releases" "$root/slots" "$release_root/dndshare-frontend-assets/static"
  chmod 750 "$root"
  cp -aln static/. "$release_root/dndshare-frontend-assets/static/"
  directory="$root/releases/$commit"
  if [[ ! -d "$directory" ]]; then
    mkdir "$stage/runtime"
    cp dndshare.new "$stage/runtime/dndshare"
    cp dndshare-run.sh fetch-secrets.sh fetch-secrets.py nginx-dndshare.conf nginx-dndshare-http.conf "$stage/runtime/"
    printf '%s\n' "$commit" > "$stage/runtime/commit"
    (cd "$stage/runtime"; sha256sum dndshare dndshare-run.sh fetch-secrets.sh fetch-secrets.py > binary.sha256)
    mv -- "$stage/runtime" "$directory"
  fi
  [[ ! -L "$directory" && "$(cd "$directory" && pwd -P)" == "$directory" ]]
  cmp -s dndshare.new "$directory/dndshare"
  (cd "$directory"; sha256sum -c binary.sha256)
  sudo install -d -m 755 "$system_root/systemd/system" "$system_root/nginx/conf.d" "$system_root/letsencrypt/renewal-hooks/deploy" "$system_root/systemd/journald.conf.d"
  sudo install -m 644 dndshare.service "$system_root/systemd/system/dndshare@.service"
  sudo install -m 750 certbot-reload-nginx.sh "$system_root/letsencrypt/renewal-hooks/deploy/dndshare-nginx"
  sudo install -m 644 journald-storage.conf "$system_root/systemd/journald.conf.d/60-dndshare-storage.conf"
  sudo systemctl daemon-reload
  switch_release "$commit" "$directory"
}
rollback_release() {
  candidate_started=false
  target_slot="$(cat "$root/previous")"
  [[ "$target_slot" == blue || "$target_slot" == green ]] || { echo 'No previous managed slot.' >&2; return 1; }
  stage="$(mktemp -d "$release_root/dndshare-deploy.XXXXXX")"
  local directory commit
  directory="$(readlink -f "$root/slots/$target_slot")"
  commit="$(cat "$directory/commit")"
  [[ "$commit" =~ ^[0-9a-f]{40}$ && "$directory" == "$root/releases/$commit" ]]
  (cd "$directory"; sha256sum -c binary.sha256)
  switch_release "$commit" "$directory"
}

if [[ "${DNDSHARE_DEPLOY_LIBRARY_ONLY:-0}" != 1 ]]; then
  trap cleanup EXIT
  trap restore ERR HUP INT TERM
  exec 9>"$release_root/.dndshare-deploy.lock"
  flock -w 300 9
  case "${1:-}" in install) shift; install_release "$@" ;; rollback) rollback_release ;; *) exit 2 ;; esac
fi

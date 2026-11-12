#!/usr/bin/env bash
set -eu
command="$(basename "$1")"; shift
state="$DNDSHARE_DEPLOY_HOME/mock"
root="$DNDSHARE_DEPLOY_HOME/dndshare-deployment"
case "$command" in
sudo) exec "$@" ;;
nginx)
  if [[ -f "$state/fail-config" ]]; then rm "$state/fail-config"; exit 1; fi
  ;;
systemctl)
  printf '%s\n' "$*" >> "$state/operations"
  action="$1"; unit="${2:-}"
  case "$action" in
  is-active)
    case "${3:-}" in dndshare@blue|dndshare) test -f "$state/up-8080" ;; dndshare@green) test -f "$state/up-8081" ;; *) exit 1 ;; esac
    ;;
  start|stop)
    case "$unit" in dndshare@blue|dndshare) port=8080; slot=blue ;; dndshare@green) port=8081; slot=green ;; *) exit 2 ;; esac
    if [[ "$action" == stop ]]; then rm -f "$state/up-$port";
    else cat "$root/slots/$slot/commit" > "$state/up-$port"; fi
    ;;
  reload)
    if [[ -f "$state/fail-reload" ]]; then rm "$state/fail-reload"; exit 1; fi
    sed -n 's/.*127.0.0.1:\([0-9]*\).*/\1/p' "$DNDSHARE_SYSTEM_ROOT/nginx/conf.d/dndshare-upstream.conf" > "$state/proxy"
    ;;
  esac
  ;;
curl)
  address=''
  for value in "$@"; do [[ "$value" != http* ]] || address="$value"; done
  port="$(sed -n 's#http://127.0.0.1:\([0-9]*\)/.*#\1#p' <<< "$address")"
  if [[ "$address" == *'/internal/deployment/activate?'* ]]; then
    echo "activate $port" >> "$state/operations"
    [[ "$port" != 8081 || ! -f "$state/fail-activate" ]] || exit 22
    other=8080; [[ "$port" != 8080 ]] || other=8081
    [[ ! -f "$state/up-$other" ]] || { echo 'Recovery ran before the old instance stopped' >&2; exit 1; }
    echo '{"active":true}'
    exit 0
  fi
  if [[ -z "$port" ]]; then
    [[ ! -f "$state/fail-proxy" ]] || exit 22
    port="$(cat "$state/proxy")"
  fi
  [[ "$port" != 8081 || ! -f "$state/fail-health" ]] || exit 22
  [[ -f "$state/up-$port" ]] || exit 22
  printf '{"status":"ok","commitSha":"%s"}\n' "$(cat "$state/up-$port")"
  ;;
*) echo "Unexpected mock command: $command" >&2; exit 2 ;;
esac

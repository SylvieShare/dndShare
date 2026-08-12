#!/usr/bin/env bash

set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "usage: $0 <repo-relative-write-path>..." >&2
  exit 2
fi

for path in "$@"; do
  if [[ -z "$path" || "$path" = /* || "$path" = ./* || "$path" = *".."* ]]; then
    echo "invalid agent write path: $path" >&2
    exit 2
  fi

  case "$path" in
    frontend/src/shared | frontend/src/shared/* | \
      frontend/src/app | frontend/src/app/* | \
      frontend/src/stores | frontend/src/stores/* | \
      internal/store/schema | internal/store/schema/* | \
      deploy | deploy/* | .github | .github/* | \
      AGENTS.md | CLAUDE.md | README.md | main.go | go.mod | go.sum | \
      frontend/package.json | frontend/package-lock.json | \
      frontend/vite.config.* | frontend/vitest.config.*)
      echo "root-owned path is forbidden in an agent write allowlist: $path" >&2
      exit 1
      ;;
  esac
done

echo "agent write allowlist OK (${#} paths)"

#!/usr/bin/env bash
set -euo pipefail

timeout="${1:?Pemakaian: wait-healthy.sh <detik> <kontainer...>}"
shift

deadline=$((SECONDS + timeout))

state() {
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$1" 2>/dev/null || echo "tidak ada"
}

for name in "$@"; do
  while true; do
    current="$(state "$name")"
    if [ "$current" = "healthy" ] || [ "$current" = "running" ]; then
      echo "$name: $current"
      break
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      echo "::error::$name belum sehat setelah ${timeout} detik (status: $current)"
      exit 1
    fi
    sleep 3
  done
done

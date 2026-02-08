#!/usr/bin/env bash
set -euo pipefail

pnpm -C apps/api start &
api_pid=$!

pnpm -C apps/worker start &
worker_pid=$!

shutdown() {
  kill "$api_pid" "$worker_pid" 2>/dev/null || true
}

trap shutdown SIGINT SIGTERM
wait -n "$api_pid" "$worker_pid"

#!/usr/bin/env bash
set -euo pipefail

# Normalize env names across Dokploy/local variants.
if [[ -z "${DATABASE_URL:-}" && -n "${PREVIEW_DATABASE_URL:-}" ]]; then
  export DATABASE_URL="${PREVIEW_DATABASE_URL}"
fi

if [[ -z "${REDIS_HOST:-}" && -n "${PREVIEW_REDIS_HOST:-}" ]]; then
  export REDIS_HOST="${PREVIEW_REDIS_HOST}"
fi

if [[ -z "${REDIS_PORT:-}" && -n "${PREVIEW_REDIS_PORT:-}" ]]; then
  export REDIS_PORT="${PREVIEW_REDIS_PORT}"
fi

pnpm --filter @corpsim/api start &
api_pid=$!

pnpm --filter @corpsim/worker start &
worker_pid=$!

shutdown() {
  kill "$api_pid" "$worker_pid" 2>/dev/null || true
}

trap shutdown SIGINT SIGTERM
wait -n "$api_pid" "$worker_pid"

#!/usr/bin/env bash
set -euo pipefail

role="${APP_ROLE:-all}"

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

run_api() {
  exec pnpm --filter @corpsim/api start
}

run_web() {
  exec pnpm --filter @corpsim/web start
}

run_worker() {
  exec pnpm --filter @corpsim/worker start
}

run_migrate() {
  exec pnpm exec prisma migrate deploy --schema packages/db/prisma/schema.prisma
}

run_all() {
  pnpm --filter @corpsim/api start &
  api_pid=$!

  pnpm --filter @corpsim/worker start &
  worker_pid=$!

  pnpm --filter @corpsim/web start &
  web_pid=$!

  shutdown() {
    kill "$api_pid" "$worker_pid" "$web_pid" 2>/dev/null || true
  }

  trap shutdown SIGINT SIGTERM
  wait -n "$api_pid" "$worker_pid" "$web_pid"
}

case "$role" in
  api)
    run_api
    ;;
  web)
    run_web
    ;;
  worker)
    run_worker
    ;;
  migrate)
    run_migrate
    ;;
  all)
    run_all
    ;;
  *)
    echo "Invalid APP_ROLE: $role"
    echo "Expected one of: api, web, worker, migrate, all"
    exit 1
    ;;
esac

#!/usr/bin/env bash
set -euo pipefail

role="${APP_ROLE:-all}"

run_api() {
  exec pnpm -C apps/api start
}

run_web() {
  exec pnpm -C apps/web start
}

run_worker() {
  exec pnpm -C apps/worker start
}

run_migrate() {
  exec pnpm exec prisma migrate deploy --schema packages/db/prisma/schema.prisma
}

run_all() {
  pnpm -C apps/api start &
  api_pid=$!

  pnpm -C apps/worker start &
  worker_pid=$!

  pnpm -C apps/web start &
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

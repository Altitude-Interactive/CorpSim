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

apply_migrations() {
  pnpm exec prisma migrate deploy --schema packages/db/prisma/schema.prisma
}

is_truthy() {
  local value="${1:-}"
  local normalized
  normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"
  [[ "$normalized" == "1" || "$normalized" == "true" || "$normalized" == "yes" || "$normalized" == "on" ]]
}

should_sync_static_catalog() {
  local configured="${CORPSIM_SYNC_STATIC_DATA_ON_START:-}"
  if [[ -n "$configured" ]]; then
    is_truthy "$configured"
    return $?
  fi

  if [[ "$role" == "all" ]]; then
    return 0
  fi

  return 1
}

sync_static_catalog() {
  if should_sync_static_catalog; then
    pnpm sim:sync-static
  fi
}

run_all() {
  # Ensure schema is current before starting long-running processes in single-container mode.
  apply_migrations
  sync_static_catalog

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
    sync_static_catalog
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

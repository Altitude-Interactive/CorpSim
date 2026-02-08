# Dokploy Dockerfile Deployment (No Compose)

This project supports Dockerfile-only runtime modes via:

- `APP_ROLE=api`
- `APP_ROLE=web`
- `APP_ROLE=worker`
- `APP_ROLE=migrate`
- `APP_ROLE=all` (runs api + worker + web in one container)

Entrypoint: `scripts/start-container.sh`

## Option A (recommended): multiple Dockerfile apps

Create separate Dokploy apps from the same repository and Dockerfile:

1. `corpsim-migrate`
   - `APP_ROLE=migrate`
   - no public port
   - run/deploy first

2. `corpsim-api`
   - `APP_ROLE=api`
   - `API_PORT=4310`
   - expose/public port `4310`
   - `CORS_ORIGIN=https://corpsim.altitude-interactive.com`

3. `corpsim-worker`
   - `APP_ROLE=worker`
   - no public port

4. `corpsim-web`
   - `APP_ROLE=web`
   - `WEB_PORT=4311`
   - expose/public port `4311`
   - `NEXT_PUBLIC_API_URL=https://corpsim-api.altitude-interactive.com`

All runtime apps also need:

- `PREVIEW_DATABASE_URL=postgresql://postgres:<password>@postgres:5432/corpsim`
- `PREVIEW_REDIS_HOST=redis`
- `PREVIEW_REDIS_PORT=6379`

## Option B: single Dockerfile app

If you insist on one container, set:

- `APP_ROLE=all`
- `API_PORT=4310`
- `WEB_PORT=4311`
- `CORS_ORIGIN=https://corpsim.altitude-interactive.com`
- `NEXT_PUBLIC_API_URL=https://corpsim-api.altitude-interactive.com`
- `PREVIEW_DATABASE_URL=postgresql://postgres:<password>@postgres:5432/corpsim`
- `PREVIEW_REDIS_HOST=redis`
- `PREVIEW_REDIS_PORT=6379`

And publish both ports from that app (if your Dokploy app type supports multiple published ports).

## First-time world seed

Run once in any running container with DB access:

```bash
pnpm sim:seed
```

## Nginx upstream mapping

- `corpsim.altitude-interactive.com` -> `10.7.0.3:4311`
- `corpsim-api.altitude-interactive.com` -> `10.7.0.3:4310`

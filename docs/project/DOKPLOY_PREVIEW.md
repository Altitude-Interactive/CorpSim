# Dokploy Preview Deployment

This deploys a permanently running preview stack with:

- `web` (Next.js UI)
- `api` (NestJS service)
- `worker` (tick loop + bots)
- `postgres`
- `redis`
- `migrate` (one-shot Prisma migration job)

## 1) In Dokploy, create a Compose app

- Repository: `BENZOOgataga/CorpSim`
- Branch: `main`
- Compose file: `docker-compose.preview.yml`
- Auto deploy on push: enabled

## 2) Set environment variables

You can use local `.env.preview` as the canonical template for these values.

Minimum required:

- `POSTGRES_DB=corpsim`
- `POSTGRES_USER=postgres`
- `POSTGRES_PASSWORD=<strong-password>`
- `PREVIEW_DATABASE_URL=postgresql://postgres:<strong-password>@postgres:5432/corpsim`
- `PREVIEW_REDIS_HOST=redis`
- `PREVIEW_REDIS_PORT=6379`
- `API_PORT=4310`
- `API_PUBLIC_PORT=4310`
- `WEB_PORT=4311`
- `WEB_PUBLIC_PORT=4311`
- `CORS_ORIGIN=https://<your-web-domain>`
- `NEXT_PUBLIC_API_URL=https://<your-api-domain>`

Recommended worker settings:

- `TICK_INTERVAL_MS=60000`
- `SIMULATION_SPEED=1`
- `MAX_TICKS_PER_RUN=10`
- `BOT_ENABLED=true`
- `ON_INVARIANT_VIOLATION=log_only`

## 3) Networking / domains

- Route `web` publicly on `WEB_PUBLIC_PORT`.
- Route `api` publicly on `API_PUBLIC_PORT`.
- Keep `postgres` and `redis` internal only.

## 4) First deployment init

`migrate` runs automatically and applies Prisma migrations.

To seed initial world once, open a shell in the `api` container and run:

```bash
pnpm sim:seed
```

Do not run `sim:reset` in preview unless you intentionally want to wipe/reseed state.

## 5) Verify after deploy

- API health: `GET /health`
- World health: `GET /v1/world/health`
- Open the web URL and confirm overview data updates while worker ticks.

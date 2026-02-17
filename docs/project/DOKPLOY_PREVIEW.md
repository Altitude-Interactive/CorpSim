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

## 2) Set environment variables and build arguments

You can use local `.env.preview` as the canonical template for these values.

### ⚠️ Critical: Build-time vs Runtime Variables

**IMPORTANT:** Next.js `NEXT_PUBLIC_*` variables are **baked into the JavaScript bundle at build time**. In Dokploy, you MUST configure these as **build arguments** in addition to environment variables, otherwise the client-side code will not have the correct values.

**In Dokploy UI:**
1. Go to your Compose app → **Environment** tab
2. Set runtime environment variables as usual
3. **Additionally**, if Dokploy provides a "Build Arguments" section, set:
   - `NEXT_PUBLIC_API_URL=https://<your-api-domain>`

If Dokploy doesn't have a separate Build Arguments UI, note that variables set only in the **Environment** section are runtime variables and are **not** automatically available at build time. In that case, you must manually edit your `docker-compose.preview.yml` and add these as Docker build arguments (under the `args:` section of `x-app-build` or the relevant `build:` configuration for the `web` service) so that the `NEXT_PUBLIC_*` values are passed into the Next.js build.

### Minimum required environment variables:

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
- `NEXT_PUBLIC_API_URL=https://<your-api-domain>` ⚠️ **Must also be set as build argument**

Release image settings (tag-first):

- `APP_IMAGE_REPO=ghcr.io/<org-or-user>/corpsim`
- `APP_IMAGE_TAG=v0.1.0` (use release tags like `v0.1.1`, avoid commit SHAs)
- `APP_IMAGE_BYPASS_TAG=true` (optional; bypasses `APP_IMAGE_TAG` and forces Docker Compose to build from the latest checked-out commit)
- Release CI also publishes a plain semver tag (`0.1.0`) for compatibility.

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

## Troubleshooting

### Authentication failing with "Provider not found" or 404 errors

**Symptom:** When clicking "Continue with Google" (or other OAuth providers), you get:
- "Google sign-up failed - Provider not found" error
- 404 errors in browser console for `/api/auth/sign-in/social`
- Auth requests going to wrong URL (e.g., `localhost` instead of your domain)

**Cause:** The `NEXT_PUBLIC_API_URL` build argument was not set correctly when the Docker image was built. Next.js bakes these values into the client-side JavaScript bundle at build time.

**Solution:**
1. In Dokploy, ensure `NEXT_PUBLIC_API_URL` is set as a **build argument** (check Build Arguments or Build Environment section)
2. Trigger a **full rebuild** (not just a restart)
3. Verify the built image has the correct value by checking browser's network tab - requests should go to your API domain, not localhost

### API calls going to localhost or wrong domain

This is the same issue as above - `NEXT_PUBLIC_*` variables must be set as build arguments before building the image.

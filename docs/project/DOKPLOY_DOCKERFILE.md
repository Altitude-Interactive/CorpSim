# Dokploy Dockerfile Deployment (No Compose)

This project supports Dockerfile-only runtime modes via:

- `APP_ROLE=api`
- `APP_ROLE=web`
- `APP_ROLE=worker`
- `APP_ROLE=migrate`
- `APP_ROLE=all` (runs api + worker + web in one container)

Entrypoint: `scripts/start-container.sh`

## ⚠️ Critical: Next.js Build Arguments

**IMPORTANT:** When deploying the `web` app (or `APP_ROLE=all`), Next.js `NEXT_PUBLIC_*` environment variables are **baked into the JavaScript bundle at build time**, NOT at runtime.

In Dokploy, you MUST configure these as **build arguments**:
- `NEXT_PUBLIC_APP_URL=https://<your-web-domain>`
- `NEXT_PUBLIC_AUTH_URL=https://<your-web-domain>` (optional; leave empty to use same-origin)
- `NEXT_PUBLIC_API_URL=https://<your-web-domain>` (recommended for single-domain SSO) or leave empty to use same-origin routing

Setting these only as runtime environment variables will NOT work for client-side code. The browser will get the values that were present during `docker build`, not the ones set at runtime.

**In Dokploy:**
1. Check if your deployment has a "Build Arguments" or "Build Environment" section
2. Set the `NEXT_PUBLIC_*` variables there BEFORE building
3. Also set them as regular environment variables for server-side Next.js code

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
   - ⚠️ **BUILD ARGUMENTS (set before building the image):**
     - `NEXT_PUBLIC_APP_URL=https://corpsim.altitude-interactive.com`
     - `NEXT_PUBLIC_AUTH_URL=https://corpsim.altitude-interactive.com` (optional)
     - `NEXT_PUBLIC_API_URL=https://corpsim.altitude-interactive.com` (or leave empty)
   - **RUNTIME ENVIRONMENT VARIABLES:**
     - `NEXT_PUBLIC_APP_URL=https://corpsim.altitude-interactive.com`
     - `NEXT_PUBLIC_AUTH_URL=https://corpsim.altitude-interactive.com` (optional)
     - `NEXT_PUBLIC_API_URL=https://corpsim.altitude-interactive.com` (or leave empty)
     - `API_URL=http://corpsim-api:4310` (or internal Docker network address)
     - `BETTER_AUTH_URL=https://corpsim.altitude-interactive.com`

All runtime apps also need:

- `PREVIEW_DATABASE_URL=postgresql://postgres:<password>@postgres:5432/corpsim`
- `PREVIEW_REDIS_HOST=redis`
- `PREVIEW_REDIS_PORT=6379`

## Option B: single Dockerfile app

If you insist on one container, set:

**Build Arguments (must be set before building):**
- `NEXT_PUBLIC_APP_URL=https://corpsim.altitude-interactive.com`
- `NEXT_PUBLIC_AUTH_URL=https://corpsim.altitude-interactive.com` (optional)
- `NEXT_PUBLIC_API_URL=https://corpsim.altitude-interactive.com` (or leave empty)

**Runtime Environment Variables:**
- `APP_ROLE=all`
- `API_PORT=4310`
- `WEB_PORT=4311`
- `CORS_ORIGIN=https://corpsim.altitude-interactive.com`
- `NEXT_PUBLIC_APP_URL=https://corpsim.altitude-interactive.com`
- `NEXT_PUBLIC_AUTH_URL=https://corpsim.altitude-interactive.com` (optional)
- `NEXT_PUBLIC_API_URL=https://corpsim.altitude-interactive.com` (or leave empty)
- `BETTER_AUTH_URL=https://corpsim.altitude-interactive.com`
- `API_URL=http://localhost:4310` (internal server-side API access)
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

- `corpsim.altitude-interactive.com` -> `10.7.0.3:4311` (public)
- Keep API private/internal when possible; web route handlers proxy `/v1/*` and `/api/auth/*` to the API upstream.

## Troubleshooting

### Authentication failing with "Provider not found" or 404 errors

**Symptom:** When clicking "Continue with Google" (or other OAuth providers), you get:
- "Google sign-up failed - Provider not found" error  
- 404 errors in browser console for `/api/auth/sign-in/social`
- Auth requests going to wrong URL (e.g., `localhost` instead of your domain)

**Cause:** Public auth/API URLs were built with the wrong origin (often localhost or a separate API host), or missing entirely.

**Solution:**
1. In Dokploy, find the Build Arguments or Build Environment section for your app
2. Set `NEXT_PUBLIC_APP_URL` (and optionally `NEXT_PUBLIC_AUTH_URL`) to your web domain
3. Set `NEXT_PUBLIC_API_URL` to your web domain (or leave it empty for same-origin routing)
4. Set runtime `BETTER_AUTH_URL` to your web domain
5. Ensure runtime `API_URL` points to the internal API service (not the public web domain)
6. Trigger a **full rebuild** of the image (not just a restart)
7. After deployment, check browser's network tab to verify auth and API requests go to your web domain

### How to verify build-time values are correct

1. Open your web app in a browser
2. Open Developer Tools → Network tab
3. Trigger an API request (e.g., try to sign in)
4. Check request URLs - for single-domain SSO they should point to your web domain (not localhost)
5. Alternatively, check the Console tab for any warnings from CorpSim about misconfigured URLs

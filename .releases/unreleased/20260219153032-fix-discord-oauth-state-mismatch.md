---
type: patch
area: api
summary: Fix OAuth state_security_mismatch in multi-subdomain production setups
---

- Fixed `resolveAuthBaseUrl()` fallback order to prefer `APP_URL`/`WEB_URL` over `API_URL` so that Better Auth uses the correct public-facing domain (where `/api/auth/*` is proxied) when `BETTER_AUTH_URL` is not explicitly set
- Added `BETTER_AUTH_COOKIE_DOMAIN` env var support to enable `crossSubDomainCookies` in Better Auth, resolving state cookie domain mismatches when the frontend and API are on different subdomains
- Updated `.env.example` with improved documentation and the new `BETTER_AUTH_COOKIE_DOMAIN` variable

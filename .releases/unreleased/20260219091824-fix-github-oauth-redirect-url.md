---
type: patch
area: api, web, infra
summary: Fix OAuth callback redirect URLs for GitHub, Microsoft, and Discord by configuring nginx proxy and BETTER_AUTH_URL
---

- Updated nginx configuration to proxy `/api/auth/*` requests from web domain to API server
- Added documentation for configuring `BETTER_AUTH_URL` to use the main web domain in production
- Fixed OAuth callback URL issues that caused "redirect_uri is not associated with this application" errors
- Ensures all OAuth providers (GitHub, Microsoft, Discord) redirect to the correct domain

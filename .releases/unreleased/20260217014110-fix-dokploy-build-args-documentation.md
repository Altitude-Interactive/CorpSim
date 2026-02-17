---
type: patch
area: web
summary: Add runtime warnings for misconfigured NEXT_PUBLIC_API_URL and improve Dokploy deployment docs
---

Enhanced DOKPLOY_PREVIEW.md and DOKPLOY_DOCKERFILE.md with:
- Clear warnings about Next.js build-time vs runtime environment variables
- Explicit instructions to set NEXT_PUBLIC_* as build arguments
- Troubleshooting section for authentication and API URL issues
- Verification steps to confirm build-time values are correct

Added runtime configuration validation:
- auth-client.ts now warns when NEXT_PUBLIC_API_URL is missing or points to localhost in production
- api-client.ts now warns about misconfigured API URLs
- Warnings appear in browser console to help developers identify deployment issues early

This addresses issues where users set environment variables in Dokploy UI but the Next.js client bundle still uses build-time defaults (typically localhost), causing authentication failures and 404 errors when trying to use OAuth providers.

---
type: patch
area: docs
summary: Add critical documentation for NEXT_PUBLIC_* build arguments in Dokploy deployments
---

Enhanced DOKPLOY_PREVIEW.md and DOKPLOY_DOCKERFILE.md with:
- Clear warnings about Next.js build-time vs runtime environment variables
- Explicit instructions to set NEXT_PUBLIC_* as build arguments
- Troubleshooting section for authentication and API URL issues
- Verification steps to confirm build-time values are correct

This addresses issues where users set environment variables in Dokploy UI but the Next.js client bundle still uses build-time defaults (typically localhost), causing authentication failures and 404 errors when trying to use OAuth providers.

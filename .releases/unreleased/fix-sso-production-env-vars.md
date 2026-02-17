---
type: patch
area: ops
summary: Fix SSO authentication in production by wiring backend runtime env vars and frontend build-time visibility flags
---

- Changed default SSO provider visibility from enabled to disabled
- Added backend SSO runtime environment variables to the backend service in docker-compose.preview.yml
- Added frontend SSO `NEXT_PUBLIC_*` visibility flags as build args in Dockerfile
- Updated docker-compose to pass SSO toggle flags to the frontend at build time via build args
- This fixes the "provider not found" 404 error when SSO credentials are not configured

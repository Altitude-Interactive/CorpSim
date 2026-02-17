---
type: patch
area: ops
summary: Fix SSO authentication in production by passing env vars at runtime
---

- Changed default SSO provider visibility from enabled to disabled
- Added SSO environment variables to backend service in docker-compose.preview.yml
- Added SSO visibility flags as build args in Dockerfile
- Updated docker-compose to pass SSO toggle flags to frontend at build time
- This fixes the "provider not found" 404 error when SSO credentials are not configured

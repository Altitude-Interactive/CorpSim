---
type: patch
area: ci
summary: Add release smoke checks for web version, maintenance, and world health endpoints
---

- Boot the preview stack from the freshly published release image during release CI.
- Verify `/meta/version`, `/health/maintenance`, and `/v1/world/health` return valid JSON payloads.
- Tear down the smoke-test stack after the check completes.

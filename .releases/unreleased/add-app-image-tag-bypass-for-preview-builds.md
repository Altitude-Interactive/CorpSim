---
type: minor
area: ops
summary: Add APP_IMAGE_BYPASS_TAG flag to force preview image builds from latest commit
---

- Added `APP_IMAGE_BYPASS_TAG` support in `docker-compose.preview.yml`
- When set, services use `pull_policy: build` and bypass `APP_IMAGE_TAG`
- Updated `.env.example` and Dokploy preview docs with usage guidance

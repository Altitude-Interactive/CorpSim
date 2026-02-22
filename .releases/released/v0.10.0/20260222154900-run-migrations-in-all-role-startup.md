---
type: patch
area: ci
summary: Run Prisma migrations before launching services in APP_ROLE=all mode
---

- Updated `scripts/start-container.sh` so `APP_ROLE=all` applies `prisma migrate deploy` before starting API, worker, and web.
- Prevents runtime schema-readiness pauses when single-container deployments start without a dedicated migrate step.

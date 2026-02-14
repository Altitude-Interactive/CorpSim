---
type: patch
area: api
summary: Wire preview Docker env for schema readiness migration directory
---

- Set `PRISMA_MIGRATIONS_DIR` in `.env.preview` to the in-container path.
- Pass schema readiness env vars into the preview backend container.

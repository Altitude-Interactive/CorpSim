---
type: patch
area: worker
summary: Make prisma generate resilient to Windows engine lock errors and skip unchanged schema generation
---

- Route workspace prisma generation through a dedicated script with schema fingerprint caching.
- Skip prisma generation when schema and Prisma dependency inputs are unchanged.
- Retry prisma generation with backoff when Windows file-lock EPERM occurs on query engine rename.

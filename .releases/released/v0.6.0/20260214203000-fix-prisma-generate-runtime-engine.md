---
type: patch
area: ci
summary: Prevent Prisma no-engine fallback from breaking local DATABASE_URL runtime
---

- Remove no-engine retry path from Prisma generate so local runtime stays on standard library engine.
- Require usable generated client artifacts before skipping generate on cached fingerprint.

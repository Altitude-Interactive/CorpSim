---
type: patch
area: ci
summary: Fix typecheck failures in web public-links route import and bot order cancellation input
---

- Added a root `@/*` path mapping to `apps/web/src/*` so root `tsc` resolves web alias imports used by app route handlers.
- Removed an invalid `companyId` property passed to `cancelMarketOrderWithTx` in bot order cleanup.

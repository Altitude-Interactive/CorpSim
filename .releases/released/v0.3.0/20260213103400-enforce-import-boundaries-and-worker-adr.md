---
type: patch
area: ci
summary: Enforce import boundary checks in CI and document BullMQ worker decision
---

- Added `scripts/check-import-boundaries.mjs` and wired it into `pnpm verify` via `pnpm lint:boundaries`.
- Boundary checks now fail on deep imports into `packages/*/src` or `@corpsim/*/src`.
- Added ADR 0001 documenting the accepted decision to migrate worker runtime to BullMQ.

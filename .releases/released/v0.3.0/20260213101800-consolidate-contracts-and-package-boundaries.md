---
type: patch
area: api
summary: Consolidate API/web contracts and workspace package boundaries for simulation services
---

- Added `@corpsim/shared` for shared request/response contracts and wired both API and web to consume it.
- Replaced deep relative imports with workspace package imports (`@corpsim/sim`, `@corpsim/db`) and added package exports.
- Split web API client into `api-client`, `api-parsers`, and endpoint modules while preserving the existing `@/lib/api` surface.
- Added `sim:stats` and `scripts/sim-stats.ts` for required simulation health stats reporting.

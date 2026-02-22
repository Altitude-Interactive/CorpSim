---
type: patch
area: db
summary: Add idempotent static catalog sync and run it on container startup
---

- Add `syncStaticCatalog` to upsert items, recipes, recipe inputs, research nodes, unlock links, and prerequisites without resetting world state.
- Ensure missing `CompanyRecipe` links are created for existing companies so newly added recipes become available.
- Add `pnpm sim:sync-static` and wire startup to run catalog sync automatically in `APP_ROLE=all` (or when `CORPSIM_SYNC_STATIC_DATA_ON_START=true`).

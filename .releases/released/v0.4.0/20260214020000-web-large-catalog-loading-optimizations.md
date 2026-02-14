---
type: patch
area: web
summary: Optimize large catalog loading and rendering for items, recipes, and research data.
---

- Add shared client-side request cache/in-flight dedupe for heavy catalog endpoints (`items`, `regions`, `production recipes`) and short-lived `research` reads.
- Invalidate cached catalogs automatically after world reset and invalidate research cache after research mutations.
- Reduce production and research load by rendering paged/filtered subsets instead of full large tables.
- Trigger production/research auto-refresh only when completion thresholds are reached rather than every tick.

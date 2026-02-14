---
type: patch
area: web
summary: Improve dev catalog input responsiveness with deferred search and precomputed item index rows.
---

- Use deferred search values for Items, Recipes, and Research filters to prevent synchronous UI stalls while typing.
- Precompute item row metadata/search text once per snapshot instead of recomputing on every keystroke.
- Show a lightweight “Updating results…” indicator while deferred filtering catches up.

---
type: patch
area: web
summary: Optimize dev catalog performance with pagination for heavy tables and on-demand consistency checks.
---

- Add pagination and search controls to Recipes and Research sections with page size caps.
- Remove unused heavy item-usage detail allocations in item processing.
- Make consistency checks opt-in to avoid expensive validation work by default.

---
type: patch
area: web
summary: Reduce abrupt page resizing during search by stabilizing paginated table heights.
---

- Add reusable `TableFillerRows` helper to keep paginated tables at a stable visual height when filtered results shrink.
- Apply stable-height table fillers to heavy market, inventory, contracts, and logistics tables.
- Keep search responsiveness while preventing harsh layout jumps during filtering.

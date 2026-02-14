---
type: minor
area: web
summary: Scale player pages for large economies with paginated market tables and unlocked-item-only selectors.
---

- Add company-scoped production recipe reads so player pages can request only unlocked recipes.
- Filter player-facing item selectors (market, production, logistics, contracts, analytics) to unlocked/owned-relevant items instead of full global catalog.
- Add user-friendly pagination and search to Market `Order Book`, `My Orders`, and `Recent Trades` tables for large datasets.
- Keep full-catalog behavior for development views by using unscoped recipe reads there.

---
type: patch
area: web
summary: Optimize heavy data pages with pagination, deferred search, and bounded dropdown rendering.
---

- Add pagination controls and page-size selectors to inventory and contract tables to avoid large full-table renders.
- Add deferred search + bounded item-option rendering (with capped dropdown option count) on heavy item selectors in market, contracts, logistics, and analytics.
- Reduce contract list load scope for the Available tab by querying only open contracts with a lower cap.

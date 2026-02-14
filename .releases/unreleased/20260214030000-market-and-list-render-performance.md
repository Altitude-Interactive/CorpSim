---
type: patch
area: web
summary: Improve market and large-list page responsiveness with lighter refresh paths and faster item rendering.
---

- Add market order status filtering in API/web contracts and default the market order book to `OPEN` in the UI.
- Optimize market page refresh flow to avoid redundant catalog reloads and skip loading-state churn during tick-driven background refreshes.
- Reduce default market table page size to 20 and precompute search indexes for order/trade filtering.
- Improve item-heavy rendering performance by memoizing item label/icon components and switching item icons to lightweight lazy-loaded `<img>` rendering.
- Lower default page sizes for production recipes and research initiative lists to improve responsiveness on large datasets.
- Add deferred inventory search input to keep typing responsive on large inventories.

---
type: minor
area: sim
summary: Fix agriculture recipe inputs and add missing item tracking system
---

- Replace metal/ore inputs with agriculture-specific inputs (Water, Fertilizer, Bio Substrate) for series 35 (CP_AGRI_PRODUCE) and series 34 (CP_BIO_VEGETATION) tier 1 items
- Add database schema for tracking missing item requests via MissingItemLog table
- Add diagnostics API endpoints for logging and retrieving missing item requests
- Update frontend item-icon component to send missing icon reports to API for centralized tracking
- Add new agriculture input items to bot and player inventories with market seed orders

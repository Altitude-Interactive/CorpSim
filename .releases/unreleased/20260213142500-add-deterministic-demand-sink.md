---
type: minor
area: sim
summary: Add deterministic baseline demand sink consumption to create persistent market pull
---

- Add a deterministic demand sink service that consumes available non-player inventory for configurable item codes each tick.
- Wire demand sink execution into the transactional tick pipeline after deliveries and before contracts/candle aggregation.
- Add worker configuration/env controls for demand sink enablement, item set, and demand profile.
- Add unit tests for demand sink behavior and integration coverage in worker iteration tests.

---
type: minor
area: worker
summary: Migrate worker runtime to BullMQ scheduler/processor architecture with typed Redis queue config
---

- Replaced in-process timer loop in worker runtime with BullMQ-backed scheduler and job processor.
- Added typed worker runtime config for Redis and BullMQ settings with env validation.
- Kept `worker:once` deterministic direct iteration mode for operational tooling and CI use.
- Added worker config tests plus updated env and README worker runtime configuration docs.

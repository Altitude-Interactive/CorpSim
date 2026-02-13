---
type: patch
area: worker
summary: Harden BullMQ tick processing with DB idempotency keys, global leases, and persisted control state
---

- Process tick batches as per-tick conflict-retry units to avoid partial-batch over-advancement.
- Add DB-backed simulation leases and execution keys so duplicate/retried BullMQ jobs are neutralized.
- Persist invariant response controls (pause/stop) in the database for multi-instance consistency.
- Enforce deterministic worker startup guardrails (single processor concurrency and scheduler authority lease).

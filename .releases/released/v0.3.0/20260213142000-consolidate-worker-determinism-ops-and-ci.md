---
type: patch
area: worker
summary: Add deterministic worker preflight, tick execution retention cleanup, control reset ops path, and CI worker integration gate
---

- Add worker startup preflight that verifies determinism tables exist before runtime boot.
- Add configurable retention cleanup for SimulationTickExecution rows to prevent unbounded growth.
- Add ops endpoint to reset persisted simulation control flags and allow it under maintenance bypass rules.
- Add explicit worker integration test execution in verify CI after migrations and simulation reset.

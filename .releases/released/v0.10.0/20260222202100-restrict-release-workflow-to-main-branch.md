---
type: patch
area: ci
summary: Restrict release workflow to main branch for both automatic and manual runs
---

- Added a `main` branch filter to the release workflow's `workflow_run` trigger.
- Added a job-level guard so manual dispatch runs only when dispatched from `refs/heads/main`.

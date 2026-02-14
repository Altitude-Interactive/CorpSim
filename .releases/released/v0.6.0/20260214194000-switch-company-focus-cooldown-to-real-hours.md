---
type: patch
area: sim
summary: Change company focus cooldown from ticks to hours
---

- Track company focus cooldown with wall-clock timestamps instead of simulation ticks.
- Return remaining cooldown in hours and show the same rule in the company focus UI.

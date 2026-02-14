---
type: patch
area: sim
summary: Enforce cooldown between company focus changes
---

- Add a specialization change cooldown so player companies cannot switch focus repeatedly in back-to-back ticks.
- Persist the last specialization change tick and return a clear validation error when a switch is still on cooldown.

---
type: minor
area: web
summary: Add centralized UI sound feedback with unlock-safe playback, settings, and event/action cues.
---

- Introduce a browser-policy-compliant UI SFX manager with lazy-loaded sound buffers, gesture-based unlock/resume handling, and global/category throttling.
- Add persistent player sound settings (enable toggle and volume) in the top bar, with immediate effect and localStorage persistence.
- Wire sound cues to meaningful action successes, toast feedback, modal-style open/close interactions, and notable state transitions (production/research completion, shipment arrival, contract updates).

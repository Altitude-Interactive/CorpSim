---
type: patch
area: ci
summary: Expand and harden .env.preview with required and recommended production values
---

- Replace inline sensitive sample values with safe placeholders in `.env.preview`.
- Add missing critical variables for production auth, ops token, URL wiring, and queue/runtime behavior.
- Include recommended optional tuning values for auth abuse protection and simulation/bot controls.

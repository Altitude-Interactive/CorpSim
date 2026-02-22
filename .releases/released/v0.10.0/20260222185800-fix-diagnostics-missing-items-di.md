---
type: patch
area: api
summary: Fix diagnostics missing-items endpoint DI so missing item logs can be created
---

- Harden diagnostics controller service injection with explicit @Inject assignment to avoid undefined service at runtime.

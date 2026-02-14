---
type: patch
area: sim
summary: Configure company focus cooldown via environment variables
---

- Read company focus cooldown hours from `COMPANY_SPECIALIZATION_CHANGE_COOLDOWN_HOURS` in API/sim logic.
- Read `NEXT_PUBLIC_COMPANY_SPECIALIZATION_CHANGE_COOLDOWN_HOURS` in web UI so the displayed value matches env configuration.

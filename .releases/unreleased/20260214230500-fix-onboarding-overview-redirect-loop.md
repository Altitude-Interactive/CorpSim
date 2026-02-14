---
type: patch
area: web
summary: Fix onboarding-to-overview redirect loop after completing company setup
---

- Refresh onboarding status on route changes in auth route gate to prevent stale redirect decisions.
- Ensure redirects only run after onboarding state is resolved for the current page.

---
type: patch
area: web, auth
summary: Show Google auth actions by default on sign-in and sign-up unless explicitly disabled
---

- Update Google auth feature flag parsing to default to enabled when unset.
- Keep explicit opt-out behavior via `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false`.

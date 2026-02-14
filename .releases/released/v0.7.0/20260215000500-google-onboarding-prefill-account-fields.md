---
type: minor
area: api, web, auth
summary: Require onboarding account details after Google sign-up with sensible prefill
---

- Extend onboarding completion to accept optional `displayName` and `username` updates for the authenticated account.
- Prefill onboarding account fields from current session data (name/email/username) while still requiring user confirmation.
- Keep company setup in onboarding flow while allowing first-time Google users to finalize profile fields before entering the dashboard.

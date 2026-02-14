---
type: patch
area: api, web, auth
summary: Fix onboarding 403 for Google-auth users missing player rows and reduce AudioContext unlock warnings
---

- Auto-provision a missing `Player` record from authenticated user data during onboarding status/complete requests.
- Guard UI audio unlock attempts behind active browser user activation to avoid autoplay warning spam.

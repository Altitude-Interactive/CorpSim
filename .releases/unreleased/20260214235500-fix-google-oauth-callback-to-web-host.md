---
type: patch
area: web, auth
summary: Fix Google OAuth callback to return to web app host instead of API host
---

- Build social auth callback URLs with the web app origin (`NEXT_PUBLIC_APP_URL` or browser origin).
- Ensure Google sign-in and sign-up redirect back to game routes such as `/overview` and `/onboarding`.

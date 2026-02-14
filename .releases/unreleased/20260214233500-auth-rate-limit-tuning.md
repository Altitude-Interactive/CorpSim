---
type: patch
area: api, auth
summary: Add configurable auth rate limiting with stricter anti-abuse rules for sign-in, sign-up, 2FA, and password reset
---

- Enable Better Auth rate limiting with environment-based tuning and endpoint-specific limits.
- Add auth abuse-protection tuning for IP header parsing and IPv6 subnet normalization.
- Add integration coverage to verify repeated sign-in attempts are blocked.

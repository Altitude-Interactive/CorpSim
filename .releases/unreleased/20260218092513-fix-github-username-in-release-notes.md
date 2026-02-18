---
type: patch
area: ci
summary: Fix release notes to mention GitHub usernames instead of email addresses
---

- Use GitHub API to fetch actual GitHub usernames for release note mentions
- Fall back to email-based extraction when API is unavailable
- Fixes issue where `@contact` was shown instead of `@BENZOOgataga`

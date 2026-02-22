---
type: patch
area: web
summary: Hide seeded example.com accounts from admin user listing
---

- Filtered admin dashboard user rows to exclude seeded accounts with emails ending in `@example.com`.
- Keeps production/real user account management focused and uncluttered.

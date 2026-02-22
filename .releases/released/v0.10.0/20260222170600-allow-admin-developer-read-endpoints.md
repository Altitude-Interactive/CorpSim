---
type: patch
area: api, web
summary: Allow admin accounts to access developer page read endpoints
---

- Updated player-id guard logic to permit admin `GET` access on the specific catalog endpoints used by `/developer`.
- Kept admin restrictions in place for write operations and non-allowlisted gameplay endpoints.

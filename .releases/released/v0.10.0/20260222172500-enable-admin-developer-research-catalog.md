---
type: patch
area: api, web
summary: Enable admin access to developer research catalog without player ownership
---

- Added admin-only research catalog read path that selects a player-owned company when no company ID is provided.
- Kept existing player ownership enforcement for non-admin research access and all research mutations.

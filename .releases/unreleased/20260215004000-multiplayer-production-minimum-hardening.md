---
type: minor
area: api, db
summary: Harden production multiplayer baseline by locking world mutation routes and production seeding behavior
---

- Require valid operator token for `/v1/world/advance` and `/v1/world/reset` in production.
- Make seeded player/company opt-out by default in production seeding while keeping dev/test behavior unchanged.
- Update roadmap with remaining multiplayer hardening and expansion items.

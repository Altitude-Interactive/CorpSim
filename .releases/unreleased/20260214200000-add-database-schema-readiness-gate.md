---
type: minor
area: api
summary: Add database schema readiness checks that block game loading until updates are applied
---

- Add a schema readiness endpoint and block `/v1/*` game APIs when database migrations are out of date.
- Add a frontend load gate that shows a clear recovery message while schema readiness is failing.

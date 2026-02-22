---
type: patch
area: web
summary: Fix buildings definitions API response parsing in web client
---

- Parse `/v1/buildings/definitions` using the `definitions` field from object payloads.
- Prevent runtime error: `Invalid response field "definitions" (expected array)`.

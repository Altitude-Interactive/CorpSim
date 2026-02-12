---
type: patch
area: web
summary: Fix production proxy response decoding and maintenance/version endpoint fallbacks
---

- Remove response headers in the web API proxy that can cause browser content decoding failures.
- Add web-level proxy routes for maintenance and version metadata endpoints.
- Prevent production clients from polling the local development maintenance fallback endpoint.

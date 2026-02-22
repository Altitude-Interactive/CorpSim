---
type: patch
area: web, api
summary: Support single-origin SSO by proxying auth routes and preferring web origin for auth base URL
---

- Added Next.js proxy routing for `/api/auth/*` to the API upstream so auth can run on the web origin.
- Updated Better Auth base URL precedence to prefer explicit/web origins before internal API URLs.
- Hardened web API upstream resolution to avoid accidental proxy loops when public URLs point to the web origin.
- Updated deployment docs and env examples for single-domain SSO setup.

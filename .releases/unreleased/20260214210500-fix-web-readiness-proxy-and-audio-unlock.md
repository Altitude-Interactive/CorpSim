---
type: patch
area: web
summary: Fix production readiness proxy and reduce AudioContext unlock warnings
---

- Add `/health/readiness` Next.js proxy route so readiness checks work when web and API are split.
- Avoid attempting audio unlock during passive sound playback before user interaction.

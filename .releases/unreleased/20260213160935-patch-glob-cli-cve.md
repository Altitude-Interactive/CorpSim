---
type: patch
area: web
summary: Force patched glob versions to mitigate CVE-2025-64756 in transitive tooling.
---

- Add pnpm overrides to resolve vulnerable glob ranges to fixed releases.
- Regenerate lockfile so transitive dependency resolution uses glob 10.5.0+ where applicable.

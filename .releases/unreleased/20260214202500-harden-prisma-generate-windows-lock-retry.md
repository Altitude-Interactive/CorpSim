---
type: patch
area: ci
summary: Harden Prisma generate against Windows file locks in dev workflows
---

- Add Windows lock-safe Prisma generate fallback that retries with no-engine mode.
- Keep hard failures for real generate errors while reducing EPERM lock disruption.

---
type: patch
area: db
summary: Stabilize Prisma client generation during install and dev startup
---

- Added root Prisma generation hooks (`postinstall`, `preapi:dev`, `preworker:dev`, `preworker:once`) to ensure generated client artifacts exist before runtime.
- Updated `packages/db` generate script to set `PRISMA_GENERATE_SKIP_AUTOINSTALL=1`, preventing lockfile-changing auto-installs during frozen installs.
- Added package-local Prisma tooling deps in `packages/db` so Prisma generation resolves consistently under pnpm workspace linking.
- Performed a clean dependency reinstall and verified only Prisma 6.19.2 remains installed.

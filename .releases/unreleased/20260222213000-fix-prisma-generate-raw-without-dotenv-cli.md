---
type: patch
area: db
summary: Run Prisma generate without relying on dotenv-cli shell binary
---

- Replace `packages/db` `generate:raw` command with a Node wrapper script.
- Load `.env` directly in the wrapper and invoke `pnpm exec prisma generate`.
- Avoid Windows shell failures when the `dotenv` CLI binary is not linked in `node_modules/.bin`.

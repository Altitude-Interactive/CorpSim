---
type: patch
area: ci
summary: Fix verify workflow worker integration test command to use pnpm --dir with exec.
---

- Replace the malformed `pnpm -C apps/api vitest ...` invocation with `pnpm --dir apps/api exec vitest ...`.

---
type: patch
area: ci
summary: Ignore generated Next.js next-env typings in root ESLint to unblock verify pipeline.
---

- Exclude **/next-env.d.ts from root ESLint scanning.
- Prevent CI pnpm verify from failing on framework-generated triple-slash directives.

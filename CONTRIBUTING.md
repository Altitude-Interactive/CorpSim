# Contributing to CorpSim

Thanks for helping improve CorpSim. This file explains the expected workflow for changes, tests, and pull requests.

## Quick Rules

- Open a pull request for any change. Direct pushes to `main` are blocked.
- Keep PRs small and focused.
- Don’t commit secrets (tokens, client secrets, passwords). Use environment variables.
- If you change gameplay/economy rules, add tests.
- Follow the repo golden rules in `docs/agents/AGENTS.md`.

## Dev Setup

Prereqs:
- Node.js 20+
- pnpm
- Docker (for Postgres/Redis)

Install dependencies:
```bash
pnpm install
```

Start infra:
```bash
docker compose up -d postgres redis
```

Apply migrations + seed (dev only):
```bash
pnpm -C packages/db prisma migrate dev
pnpm -C packages/db seed
```

Run apps:
```bash
pnpm -C apps/api dev
pnpm -C apps/worker dev
pnpm -C apps/web dev
```

## Maintenance Mode (Important)

Before any work that mutates the running game state (migrations, seed/reset, write scripts, or changes that require it), enable maintenance mode:
```bash
pnpm maintenance:on --reason "Short reason"
```

When done:
```bash
pnpm maintenance:off
```

If no local services are running, the command will no-op and you can keep coding.

## Release Notes Entries (Required)

For any non-trivial change, add a file under `.releases/unreleased/*.md` with frontmatter:
```md
---
type: patch
area: api
summary: One-line description of what changed.
---
```

Notes:
- Don’t bump `package.json` versions in normal commits.
- A version bump happens only via the release cut process (`pnpm release:cut`), typically by maintainers.

## Tests and Quality Gates

Run these before opening a PR:
```bash
pnpm typecheck
pnpm lint
pnpm test
```

CI runs a `Verify Gate` check. Some documentation-only changes may skip heavier jobs, but you should still keep PRs clean and reviewable.

## Code Style Expectations

- TypeScript strict, avoid `any`.
- Keep business logic out of controllers/routes. Put it in services/modules.
- The simulation should remain deterministic: no random behavior without explicit, seeded inputs.
- Keep `packages/sim` free of auth/session concerns.

## Database Changes

- Use Prisma migrations (`packages/db/prisma/migrations`).
- Avoid manual SQL unless necessary; document it if you must.
- Treat migrations as production-impacting: coordinate and keep them small.

## Security

- Never commit secrets. If a secret is exposed, rotate it immediately.
- Avoid storing tokens in `localStorage` in the web app; prefer secure cookies/sessions.
- Report security issues privately if the repo has a security policy (`SECURITY.md`).

## Pull Request Checklist

- [ ] PR is small and focused
- [ ] Tests added/updated (if behavior changed)
- [ ] `.releases/unreleased/*.md` entry added (if applicable)
- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass locally
- [ ] No secrets in commits


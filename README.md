# CorpSim

[![Repo](https://img.shields.io/badge/repo-private-informational)](#)
[![Node 20+](https://img.shields.io/badge/node-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm 9+](https://img.shields.io/badge/pnpm-9.x-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Security Policy](https://img.shields.io/badge/security-policy-blue)](./SECURITY.md)

CorpSim is a solo-first, SimCompanies-inspired management and economy webgame.
It runs a persistent simulation with AI/bot companies, market dynamics, regional flows, and an ERP-style interface.

## Contents

- [CorpSim](#corpsim)
  - [Contents](#contents)
  - [What You Get](#what-you-get)
  - [Tech Stack](#tech-stack)
  - [Monorepo Layout](#monorepo-layout)
  - [Quick Start](#quick-start)
  - [Run Services](#run-services)
  - [Simulation Commands](#simulation-commands)
  - [Quality Gates](#quality-gates)
  - [Key Endpoints](#key-endpoints)
  - [Environment Notes](#environment-notes)
  - [Documentation](#documentation)
  - [Security](#security)
  - [Release Workflow](#release-workflow)

## What You Get

- Authoritative backend simulation (`api` + `worker`).
- Persistent world tick engine with bots and market participation.
- Regional market and company operations flows.
- Next.js web client with keyboard controls, overlay manager, and sound feedback.
- Dockerized local infrastructure (`postgres`, `redis`).

## Tech Stack

- TypeScript + Node.js
- NestJS (API)
- Next.js (web)
- BullMQ + Redis (simulation jobs)
- PostgreSQL + Prisma (database/migrations)
- pnpm workspaces monorepo

## Monorepo Layout

```text
apps/
  api/      # authoritative API
  web/      # frontend client
  worker/   # simulation + bots runtime
packages/
  db/       # prisma schema, migrations, seed
  shared/   # shared contracts/types
  sim/      # simulation/domain packages
docs/       # architecture, design, ADRs, project docs
scripts/    # helper scripts (sim, release, maintenance)
```

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Create your local environment file:

```bash
cp .env.example .env
```

3. Start local infra:

```bash
docker compose up -d postgres redis
```

4. Generate Prisma client and apply migrations:

```bash
pnpm -C packages/db generate
pnpm -C packages/db migrate:deploy
```

5. Seed initial simulation data:

```bash
pnpm sim:seed
```

Use `pnpm sim:reset` only when you intentionally want to wipe and reseed simulation progress.

## Run Services

Run each in its own terminal:

```bash
pnpm api:dev
pnpm worker:dev
pnpm web:dev
```

Default local ports from `.env.example`:

- API: `http://localhost:4310`
- Web: `http://localhost:4311`

## Simulation Commands

- `pnpm sim:advance --ticks <N>`: advance simulation by `N` ticks.
- `pnpm sim:seed`: seed initial world data.
- `pnpm sim:stats`: quick simulation health snapshot.
- `pnpm sim:reset`: destructive reset (dev-only).

## Quality Gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm verify`
- `pnpm verify:full`

## Key Endpoints

- `GET /health`
- `GET /health/maintenance`
- `GET /v1/world/health`
- `GET /meta/version`

## Environment Notes

Important env vars you will commonly touch:

- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PORT`
- `API_PORT`, `WEB_PORT`
- `NEXT_PUBLIC_API_URL`
- `ENFORCE_SCHEMA_READINESS`
- `COMPANY_SPECIALIZATION_CHANGE_COOLDOWN_HOURS`
- `NEXT_PUBLIC_COMPANY_SPECIALIZATION_CHANGE_COOLDOWN_HOURS`

See `.env.example` for the full list.

## Documentation

- Agent/development rules: `docs/agents/AGENTS.md`
- Root agent entrypoint: `AGENTS.md`
- UI design rules: `docs/design/DESIGN_GUIDELINES.md`
- ADR: `docs/adr/0001-worker-runtime-bullmq.md`
- Project docs index: `docs/README.md`

## Security

Security reporting process is documented in `SECURITY.md`.

## Release Workflow

- Add release entries in `.releases/unreleased/` for non-read-only changes.
- Do not bump `package.json` for normal commits.
- Cut version in dedicated release commit only: `pnpm release:cut`.
- CI workflows:
  - Verify: `.github/workflows/verify.yml`
  - Release: `.github/workflows/release.yml`

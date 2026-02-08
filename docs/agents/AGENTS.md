# AGENTS.md - CorpSim (SimCompanies-inspired webgame)

This repository builds a **management/economy webgame inspired by SimCompanies**, but implemented as a **solo-first simulation** with **AI/bot companies** to create a living market.
AGENTS.md is plain Markdown; use these instructions as the source of truth for how to work in this codebase. :contentReference[oaicite:0]{index=0}

## Product intent

### What we are building
- A **persistent economy simulation** (solo player + simulated companies) with:
  - production chains (recipes, buildings, time)
  - inventory + cash ledger
  - marketplace (buy/sell orders + matching)
  - price history + basic analytics
  - bots that participate using the **same rules** as the player

### “SimCompanies style” targets (feel)
- Optimization through **trade-offs** (time, cash, capacity, inputs).
- Market dynamics that emerge from **supply/demand** and bot behavior.
- Clear, data-driven UI: dashboards, tables, graphs, order book.

### Non-goals (for now)
- Multiplayer, anti-cheat hardening, complex auth flows
- Fancy world map / heavy animations
- Microtransactions / monetization
- Distributed/sharded architecture

## Tech stack (must match)
- **Runtime:** Node.js + TypeScript (strict)
- **Backend API:** NestJS (preferred) or Fastify (acceptable if already chosen)
- **DB:** PostgreSQL
- **ORM/Migrations:** Prisma
- **Jobs/Queues:** Redis + BullMQ
- **Frontend:** Next.js (React) for “app-like” UI
  - (Phaser may be added later as a *presentation layer*, not as the game engine)
- **Deployment:** Dokploy with a single `docker-compose.yml` (services below)

## Repo structure (expected)
- `apps/web` — Next.js frontend
- `apps/api` — HTTP API (authoritative game logic)
- `apps/worker` — tick engine + bots (BullMQ processors / schedulers)
- `packages/shared` — shared types, Zod schemas, constants (NO server secrets)
- `packages/db` — Prisma schema, migrations, db utilities
- `docker-compose.yml` — local + Dokploy deployment
- `docs/` — domain notes, runbooks, ADRs (architecture decisions)

If files differ, follow the repo reality but keep the separation of concerns.

## Core architecture rules (non-negotiable)

### 1) Server is authoritative
- The client never “creates” money/items/jobs.
- API validates all state transitions.
- Worker runs simulation ticks; the web UI only reads and requests actions.

### 2) Deterministic simulation model
- Time is discrete: `tick` is an integer (e.g., 1 tick = 1 minute).
- Simulation is reproducible from DB state + tick processing.
- “Fast-forward” is supported (advance N ticks safely).

### 3) Transactions and invariants
All state transitions that affect economic value MUST be transactional.
Examples:
- Placing an order reserves inventory/cash.
- Matching a trade transfers value atomically.
- Completing production consumes inputs and produces outputs atomically.

Invariants:
- No negative inventory (unless explicitly modeled as backorders).
- No negative cash (unless explicitly modeled as credit).
- Every value movement is recorded in a ledger/audit log.

### 4) Modularity over shortcuts
- No “temporary” inline logic inside controllers/routes.
- Domain logic lives in service modules with unit tests.
- No copy-pasted business logic between API and worker: share modules or call the same services.

## Domain model (minimum modules)
- **Company**: cash, capacity, buildings, settings
- **Inventory**: item lots/quantities per company
- **Production**: recipes, production jobs, completion
- **Market**: order book, matching, fees, trade history
- **TickEngine**: advances simulation safely; idempotent per tick
- **Bots**: strategies (producer, trader, balancer), actions executed via the same domain services
- **Analytics**: price history, volumes, simple KPIs

## Services (docker compose)
Expected services:
- `postgres`
- `redis`
- `api`
- `worker`
- `web`

Worker and API may share the same base image but must run different commands.

## Setup commands (local dev)
Prefer `pnpm`. If the repo already uses npm/yarn, follow it consistently.

- Install deps: `pnpm install`
- Start all dependencies: `docker compose up -d postgres redis`
- Apply migrations: `pnpm -C packages/db prisma migrate dev`
- Seed (dev only): `pnpm -C packages/db seed`
- Run API: `pnpm -C apps/api dev`
- Run Worker: `pnpm -C apps/worker dev`
- Run Web: `pnpm -C apps/web dev`

## Simulation operations (must exist as scripts)
We want explicit, repeatable scripts:
- `pnpm sim:advance --ticks <N>` — advances N ticks (safe/locked)
- `pnpm sim:reset` — dev reset (drops + migrates + seeds)
- `pnpm sim:seed` — seed bots + initial market state
- `pnpm sim:stats` — quick health readout (tick, order count, cash totals)

If missing, add them before adding new gameplay.

## Testing + quality gates (required)
- Typecheck must pass: `pnpm typecheck`
- Lint must pass: `pnpm lint`
- Tests must pass: `pnpm test`

Rules:
- Every change that modifies domain logic must include or update tests.
- Prefer unit tests for invariants and matching logic; integration tests for “end-to-end tick”.

## Code style and conventions
- TypeScript strict, no `any` unless justified and isolated.
- Functional purity where possible in calculation code; side effects at boundaries.
- Do not leak ORM models into API responses; map to DTOs.
- Prefer small files with clear names over giant “god services”.
- Errors: use typed domain errors (e.g., `InsufficientFundsError`) and map them at API boundary.

## API guidelines
- Keep controllers thin: validate DTO -> call service -> return DTO.
- No business logic in controllers.
- Use Zod (or class-validator consistently) and keep schemas in `packages/shared`.

## Database guidelines
- Prisma migrations only; no manual SQL in production paths unless necessary and documented.
- Add indexes for all hot paths:
  - market order matching
  - inventory lookups
  - production job completion scanning
- Any schema change must include a migration and updated seed.

## Security / ops hygiene
- Never commit secrets. Use environment variables.
- Do not add “admin endpoints” without auth/guard, even for solo—prefer CLI scripts.
- Log economic actions (orders, trades, production completion) with correlation IDs.

## How agents should work (Codex / coding agents)
When implementing tasks:
1) Read the nearest AGENTS.md (this file) and relevant docs.
2) Propose a plan as code changes: modules touched, DB changes, tests.
3) Implement with tests + migration (if needed).
4) Run typecheck/lint/tests and fix failures before finishing.
5) Keep changes minimal and modular; no quick hacks.

If any instruction conflicts, the closest AGENTS.md to the edited code wins. :contentReference[oaicite:1]{index=1}

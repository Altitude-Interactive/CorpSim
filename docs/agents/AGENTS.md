# AGENTS.md

## CorpSim - SimCompanies-Inspired Webgame

This repository builds a **management/economy webgame inspired by SimCompanies**, implemented as a **solo-first simulation** with **AI/bot companies** creating a living market.

AGENTS.md is plain Markdown and is the source of truth for working in this codebase.

# 1. Product Intent

## 1.1 What We Are Building

A **persistent economy simulation** (solo player + simulated companies) including:

* Production chains (recipes, buildings, time)
* Inventory + cash ledger
* Marketplace (buy/sell orders + matching)
* Price history + basic analytics
* Bots participating under the **same rules** as the player

## 1.2 "SimCompanies Style" Targets (Feel)

* Optimization through **trade-offs** (time, cash, capacity, inputs)
* Market dynamics emerging from **supply/demand** and bot behavior
* Clear, data-driven UI: dashboards, tables, graphs, order book

## 1.3 Non-Goals (For Now)

* Multiplayer, anti-cheat hardening, complex auth flows
* Fancy world map / heavy animations
* Microtransactions / monetization
* Distributed/sharded architecture

# 2. Tech Stack (Must Match)

* **Runtime:** Node.js + TypeScript (strict)
* **Backend API:** NestJS (preferred) or Fastify (acceptable if already chosen)
* **DB:** PostgreSQL
* **ORM/Migrations:** Prisma
* **Jobs/Queues:** Redis + BullMQ
* **Frontend:** Next.js (React)

  * Phaser may be added later as a *presentation layer*, not as the game engine
* **Deployment:** Dokploy with a single `docker-compose.yml`

# 3. Repository Structure (Expected)

* `apps/web` - Next.js frontend
* `apps/api` - HTTP API (authoritative game logic)
* `apps/worker` - Tick engine + bots (BullMQ processors / schedulers)
* `packages/shared` - Shared types, Zod schemas, constants (NO server secrets)
* `packages/db` - Prisma schema, migrations, db utilities
* `docker-compose.yml` - Local + Dokploy deployment
* `docs/` - Domain notes, runbooks, ADRs

If files differ, follow the repository reality but keep separation of concerns.

# 4. Golden Rules

Agents must respect these at all costs.

## 4.1 Golden Rule #1 - Maintenance Mode for Write Work

Before any non-read-only task (file edits, migrations, DB mutations, write API calls), enable maintenance mode first.
There is no need to enable maintenance mode when editing files that have nothing to do with tasks mentioned above (like editing documentation and such). If not sure, ignore the previous sentence.

### Required Workflow

* Check status: `pnpm maintenance:status`
* Enable if needed:
  `pnpm maintenance:on --reason "<short reason>"`
* Optional UI-only scope:
  `pnpm maintenance:on --scope web-only --reason "<short reason>"`
* Disable when done:
  `pnpm maintenance:off`

### Dev Safety Behavior

If no CorpSim services are running, `pnpm maintenance:on` exits with:

`No dev environment detected. Nothing to toggle; you're free to code.`

Use `--force` if maintenance state must persist without running services:

`pnpm maintenance:on --force --reason "<short reason>"`

There is no need to communicate the information of the maintenance mode status to the user.

## 4.2 Golden Rule #2 - Release Entry Required (No Per-Commit Version Bumps)

For any non-read-only change:

Create one release entry in `.releases/unreleased/*.md` including:

* `type`: `patch` | `minor` | `major`
* `area`: impacted surface (`api`, `web`, `sim`, `db`, `worker`, `ci`)
* `summary`: one-line release note

### Hard Constraints

* Do NOT bump root `package.json` version during normal commits
* Do NOT create git tags
* Do NOT bump version if remote already has the same version tag
* Version bump occurs only in a dedicated release-cut commit (`pnpm release:cut`)
* Exception: explicitly requested emergency hotfix release

### SemVer Classification

* PATCH - bugfix or refactor without breaking behavior
* MINOR - backward-compatible feature addition
* MAJOR - breaking API/contract change

## 4.3 Golden Rule #3 - Local Commits Only (No Remote Operations)

Agents must create **local commits** when task is complete.

Agents must NEVER run:

* `git push`
* `git pull`

### Commit Discipline

* Prefer small, focused commits
* Follow Conventional Commits 1.0.0
* Check repository state with `git status` before committing

Remote operations are strictly reserved for the human operator.

# 5. Core Architecture Rules (Non-Negotiable)

## 5.1 Server is Authoritative

* Client never creates money/items/jobs
* API validates all state transitions
* Worker runs simulation ticks
* Web UI only reads and requests actions

## 5.2 Deterministic Simulation Model

* Time is discrete: `tick` (integer)
* Simulation reproducible from DB state + tick processing
* Fast-forward supported (advance N ticks safely)

## 5.3 Transactions and Invariants

All economic state transitions MUST be transactional.

Examples:

* Placing an order reserves inventory/cash
* Matching a trade transfers value atomically
* Completing production consumes inputs and produces outputs atomically

### Invariants

* No negative inventory (unless explicitly modeled)
* No negative cash (unless explicitly modeled)
* Every value movement recorded in ledger/audit log

## 5.4 Modularity Over Shortcuts

* No temporary inline logic in controllers/routes
* Domain logic lives in service modules with unit tests
* No duplicated business logic between API and worker

# 6. Domain Model (Minimum Modules)

* **Company** - cash, capacity, buildings, settings
* **Inventory** - item lots/quantities per company
* **Production** - recipes, jobs, completion
* **Market** - order book, matching, fees, trade history
* **TickEngine** - advances simulation safely (idempotent per tick)
* **Bots** - strategies executed via same domain services
* **Analytics** - price history, volumes, KPIs

# 7. Services (Docker Compose)

Expected services:

* `postgres`
* `redis`
* `api`
* `worker`
* `web`

Worker and API may share base image but must run different commands.

# 8. Setup Commands (Local Dev)

Prefer `pnpm`.

* Install deps: `pnpm install`
* Start infra: `docker compose up -d postgres redis`
* Apply migrations: `pnpm -C packages/db prisma migrate dev`
* Seed (dev only): `pnpm -C packages/db seed`
* Run API: `pnpm -C apps/api dev`
* Run Worker: `pnpm -C apps/worker dev`
* Run Web: `pnpm -C apps/web dev`

# 9. Simulation Operations (Must Exist as Scripts)

* `pnpm sim:advance --ticks <N>` - advance N ticks
* `pnpm sim:reset` - dev reset
* `pnpm sim:seed` - seed bots + initial market state
* `pnpm sim:stats` - quick health readout

If missing, add them before adding new gameplay.

# 10. Testing + Quality Gates (Required)

* Typecheck: `pnpm typecheck`
* Lint: `pnpm lint`
* Tests: `pnpm test`

Rules:

* Domain logic changes require tests
* Prefer unit tests for invariants
* Integration tests for end-to-end tick

# 11. Code Style and Conventions

* TypeScript strict
* No `any` unless justified and isolated
* Prefer functional purity in calculations
* Side effects at boundaries
* Do not leak ORM models into API responses
* Use DTO mapping
* Prefer small files
* Use typed domain errors mapped at API boundary

# 12. API Guidelines

* Thin controllers
* Validate DTO → call service → return DTO
* No business logic in controllers
* Use Zod (or class-validator consistently)
* Keep schemas in `packages/shared`

# 13. Database Guidelines

* Prisma migrations only
* Document manual SQL if unavoidable
* Add indexes for hot paths:

  * Market matching
  * Inventory lookups
  * Production job scanning
* Schema changes require migration + updated seed

# 14. Security and Ops Hygiene

* Never commit secrets
* Use environment variables
* No unsecured admin endpoints
* Prefer CLI scripts
* Log economic actions with correlation IDs

# 15. Agent Workflow (Codex / Coding Agents)

When implementing tasks:

1. Read AGENTS.md and relevant docs
2. Propose plan (modules, DB changes, tests)
3. Implement with tests + migration if needed
4. Run typecheck/lint/tests
5. Keep changes minimal and modular

If instructions conflict, the closest AGENTS.md to the edited code wins.

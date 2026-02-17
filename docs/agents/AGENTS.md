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

## 4.4 Golden Rule #4 - Never Kill Shared Dev Processes

Agents must NEVER kill processes that may interfere with Codex terminals, developer terminals, or active local services.

### Hard Constraints

* Do NOT run broad process-kill commands (`Stop-Process` without strict PID targeting, `taskkill /IM node.exe /F`, `pkill node`, `killall node`, etc.)
* Do NOT terminate terminal hosts or shell processes used by developers/Codex
* Only terminate a process when the human operator explicitly requests it and the exact target process is unambiguous

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

# 5.5 System Boundaries (Critical for AI Agents)

AI agents MUST respect architectural boundaries to prevent introducing bugs or violating invariants.

## Layer Responsibilities

### packages/sim - Simulation Engine (Domain Layer)
**✅ Allowed:**
* All business rules and economic calculations
* Invariant validation and enforcement
* State transitions (tick pipeline, order placement, etc.)
* Deterministic logic
* Throw typed domain errors

**❌ Forbidden:**
* HTTP request handling
* Authentication/authorization logic
* Input sanitization beyond domain validation
* Response formatting (DTOs)
* Framework-specific code (NestJS, Express, etc.)

### apps/api - HTTP API Server (Orchestration Layer)
**✅ Allowed:**
* Route handling and HTTP endpoints
* Input validation (DTOs via Zod/class-validator)
* Ownership checks (assert player owns resource)
* Delegate to sim services
* Map domain models to DTOs
* Map domain errors to HTTP status codes

**❌ Forbidden:**
* Business logic (must delegate to sim)
* Economic calculations
* Direct database mutations (sim handles transactions)
* Tick advancement (worker's job)
* Duplicate domain logic from sim package

### apps/worker - Background Processor
**✅ Allowed:**
* Tick advancement execution
* BullMQ job processing
* Lease management for scheduler coordination
* Invariant monitoring after ticks
* Control enforcement (pause bots, stop processing)

**❌ Forbidden:**
* HTTP request handling
* User authentication
* API response formatting
* Duplicate domain logic from sim package

### apps/web - Frontend UI (Presentation Layer)
**✅ Allowed:**
* Display simulation state
* User input (forms, buttons)
* API calls for data fetching
* Local UI state management
* Charts and visualizations

**❌ Forbidden:**
* Business logic (read-only, delegates to API)
* Data mutations (only requests actions via API)
* Server-side validation (client validates for UX only)
* Direct database access
* Direct sim package imports

## Module Interaction Rules (MUST Follow)

### ✅ Allowed Interactions
* **sim → database**: Direct Prisma queries and transactions
* **api → sim**: Call sim service functions (delegation)
* **worker → sim**: Call tick advancement functions
* **web → api**: HTTP requests only
* **shared → all**: Import types, constants, utilities

### ❌ Forbidden Interactions
* **api → database (bypass sim)**: Never mutate database directly
* **worker → database (bypass sim)**: Never duplicate domain logic
* **api ↔ worker**: No direct RPC (communicate via database or queue)
* **web → sim**: Never import sim package in frontend
* **web → database**: Never access database from frontend
* **shared → apps/packages**: Dependency inversion violation

## Economic Invariants (Never Violate)

These constraints MUST be maintained at all times:

### Cash Integrity
```typescript
cashCents >= 0  // No negative cash
reservedCashCents >= 0
reservedCashCents <= cashCents
availableCash = cashCents - reservedCashCents
```

### Inventory Integrity
```typescript
quantity >= 0  // No negative inventory
reservedQuantity >= 0
reservedQuantity <= quantity
availableInventory = quantity - reservedQuantity
```

### Reservation Flow
1. **Reserve** resources before operations (buy orders, production)
2. **Consume** atomically (decrement both total and reserved)
3. **Release** on cancellation (decrement reserved only)

### Transaction Atomicity
* Every tick = single database transaction
* All economic operations transactional
* No partial state changes (all-or-nothing)
* Rollback on any failure

## Critical Domain Constraints

### Determinism Requirements
* No randomness in core simulation logic
* Fixed execution order for all subsystems
* Same input state → identical output state
* Reproducible from database state + tick number

### Tick Pipeline Order (NEVER REORDER)
1. Bot actions
2. Production completions
3. Research completions
4. Market matching
5. Shipment deliveries
6. Workforce updates
7. Demand sink
8. Contract lifecycle
9. Market candles
10. World state update

Changing this order is a **breaking change**.

### Optimistic Locking
* World state uses `lockVersion` for concurrency control
* Check version before operations
* Validate version after updates
* Retry on OptimisticLockConflictError

## Documentation References

For detailed architecture understanding, agents MUST read:

* **Architecture Overview**: `docs/architecture/OVERVIEW.md`
* **Simulation Pipeline**: `docs/architecture/SIMULATION_PIPELINE.md`
* **Economic Invariants**: `docs/architecture/ECONOMIC_INVARIANTS.md`
* **System Boundaries**: `docs/architecture/SYSTEM_BOUNDARIES.md`

For implementation details, read JSDoc in source files:
* `packages/sim/src/services/tick-engine.ts`
* `packages/sim/src/domain/reservations.ts`
* `packages/sim/src/domain/errors.ts`
* And other service modules

## Frontend Managers and Providers (MUST Use)

When working on frontend (apps/web), agents MUST use existing manager/provider systems instead of implementing duplicate functionality.

### ToastManager (`components/ui/toast-manager.tsx`)
**Purpose**: Centralized toast notifications and popup dialogs

**✅ Use For:**
* Success/error/warning/info messages
* Confirmation popups (async with result)
* Blocking dialogs
* User notifications

**❌ Never:**
* Create custom toast components
* Implement inline alert/notification systems
* Build custom dialog/modal systems

**Usage:**
```typescript
import { useToastManager } from '@/components/ui/toast-manager';

const { showToast, confirmPopup } = useToastManager();

// Show toast
showToast({ 
  title: "Order placed", 
  variant: "success" 
});

// Confirmation dialog
const confirmed = await confirmPopup({ 
  title: "Cancel order?",
  variant: "danger" 
});
```

### UiSfxManager (`lib/ui-sfx.ts` + `components/layout/ui-sfx-provider.tsx`)
**Purpose**: Centralized UI sound effects

**✅ Use For:**
* UI interactions (ui_open, ui_close)
* Feedback sounds (feedback_success, feedback_error, feedback_warning)
* Action sounds (action_place_order, action_start_production)
* Event sounds (event_production_completed, event_research_completed)

**❌ Never:**
* Play audio directly with HTML5 Audio API
* Create custom sound effect systems
* Bypass the SFX manager

**Usage:**
```typescript
import { useUiSfx } from '@/components/layout/ui-sfx-provider';

const { play } = useUiSfx();

// Play sound
play('feedback_success');
play('action_place_order');
```

### ControlManager (`components/layout/control-manager.tsx`)
**Purpose**: Centralized keyboard shortcuts and panel management

**✅ Use For:**
* Registering keyboard shortcuts
* Panel open/close state (side panels, dialogs)
* Shortcut customization and persistence
* Preventing shortcut conflicts

**❌ Never:**
* Add global keyboard event listeners directly
* Manage panel state with useState in components
* Hardcode keyboard shortcuts without using manager

**Usage:**
```typescript
import { useControlManager, useControlShortcut } from '@/components/layout/control-manager';

// Register shortcut
useControlShortcut({
  id: 'toggle-inventory',
  key: 'i',
  title: 'Toggle Inventory',
  onTrigger: () => console.log('Inventory toggled')
});

// Panel management
const { isPanelOpen, togglePanel } = useControlManager();
const isOpen = isPanelOpen('inventory');
togglePanel('inventory');
```

### MaintenanceProvider (`components/maintenance/maintenance-provider.tsx`)
**Purpose**: Tracks maintenance mode state for UI

**✅ Use For:**
* Checking if maintenance mode is active
* Displaying maintenance overlays
* Disabling actions during maintenance

**❌ Never:**
* Poll maintenance status manually
* Implement custom maintenance checks

### ActiveCompanyProvider (`components/company/active-company-provider.tsx`)
**Purpose**: Global active company context

**✅ Use For:**
* Getting current active company
* Company selection state
* Company-scoped operations

**❌ Never:**
* Pass company ID through prop drilling
* Store company ID in local component state for global operations

## Manager Usage Rules

1. **Always import and use existing managers** - Never reimplement
2. **Read manager source code** - Understand capabilities before coding
3. **Use provided hooks** - Don't access context directly
4. **Follow patterns** - Match existing usage in codebase
5. **Extend managers if needed** - Add to existing system, don't create parallel systems

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

# 15. Documentation Maintenance Policy

**Critical:** Documentation MUST stay aligned with code. Misleading docs are worse than no docs.

## Rules for Documentation Changes

1. **Code changes require doc updates** - If you modify behavior documented in:
   - JSDoc/TSDoc comments → Update inline documentation
   - Architecture docs (`docs/architecture/`) → Update corresponding files
   - AGENTS.md → Update if architectural boundaries change

2. **Verify claims before documenting** - Never document aspirational behavior:
   - "ACID" → Verify single-transaction execution
   - "Deterministic" → Verify no randomness, fixed ordering
   - "Atomic" → Verify all-or-nothing rollback
   - "Idempotent" → Verify deduplication mechanism exists

3. **Update docs in same PR as code** - Not later, not separately:
   - JSDoc updates alongside function changes
   - Architecture doc updates alongside system refactors
   - Examples updated when APIs change

4. **Flag doc drift during review** - If you spot outdated documentation:
   - Comment on PR if found during review
   - Create issue if found during development
   - Fix immediately for critical invariants

5. **Link docs to code** - Make references explicit:
   - JSDoc: Reference specific functions/modules
   - Architecture docs: Reference actual file paths
   - Examples: Use real code snippets, not pseudo-code

## Documentation Hierarchy

When conflicts arise, precedence (highest to lowest):
1. **Code implementation** - Source of truth
2. **JSDoc in source files** - Module/function-level detail
3. **Architecture docs** - High-level system design
4. **AGENTS.md** - Development rules and boundaries

# 16. Agent Workflow (Codex / Coding Agents)

When implementing tasks:

1. Read AGENTS.md and relevant docs
2. Propose plan (modules, DB changes, tests)
3. Implement with tests + migration if needed
4. Run typecheck/lint/tests
5. Keep changes minimal and modular
6. **Update documentation** if behavior changes

If instructions conflict, the closest AGENTS.md to the edited code wins.

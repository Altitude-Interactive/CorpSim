# Codex Session Context Dump

Generated: 2026-02-08
Location: `C:\Users\mrdar.DESKTOP-B6LKOPF\Documents\Git\CorpSim`

This file is a consolidated context dump of the full interactive session history that led to the current repository state.

## Session-Level Intent

Primary product direction throughout the session:
- Build CorpSim as a SimCompanies-inspired solo-first economy simulation.
- Keep server/worker authoritative.
- Keep client thin (no game logic in UI).
- Use ERP-style dark dashboard UI.
- Add systems incrementally with transactional correctness and invariants.

## Standing Operating Constraints from User

Repeatedly enforced constraints:
- Read AGENTS instructions for every task.
- For UI tasks, read design guidelines.
- Keep controllers thin.
- Put business logic in `packages/sim`.
- No fake calculations or placeholder economy logic.
- No frontend shortcuts; keep modular structure.
- Any schema change requires migration and seed updates.
- Keep full verification green.
- "Never kill processes" was explicitly requested later in the session.

## High-Level Delivery Sequence Across the Session

### 1) Simulation foundation and invariants
- Core economy schema, seed world, reset/advance scripts.
- Invariant tests for inventory/cash/reserves.
- Tick advancement tooling and lock conflict handling.

### 2) API boundary (NestJS) on top of sim core
- Introduced `apps/api` with strict validation and centralized error mapping.
- Exposed health/world/company/market read endpoints.
- Added integration tests for world tick and tick advance.
- Root scripts for API dev and API tests.

### 3) Market write path + ledger correctness
- Added order placement/cancel API and domain logic.
- Added reserve semantics with transaction-safe updates.
- Added/adjusted ledger semantics around cash vs reserved cash.
- Added tests for BUY/SELL reserve behavior, insufficient funds/inventory, cancel idempotency.

### 4) Tick-time market matching and settlement
- Implemented deterministic matching and partial fills in sim layer.
- Added settlement and trade recording.
- Added ledger entries for buyer/seller settlement.
- Wired matching into tick advancement flow.
- Added unit + integration tests for matching behavior.

### 5) Worker loop and bots
- Added `apps/worker` runtime loop.
- Configurable tick interval/speed/caps, retries, and graceful shutdown.
- Added basic liquidity/producer bot behavior using shared sim services.
- Added worker scripts and integration checks.

### 6) Observability and guardrails
- Added world health endpoint with counts/sums and invariants summary.
- Added invariants scanner utility with capped issue output.
- Added worker invariant check policy knobs.

### 7) Frontend ERP shell (Next.js + dark dashboard)
- Added web shell/pages/data polling.
- Added read-only domain views first.
- Added market write UX, active company context, trades visibility.
- Added world dev controls and polling strategy improvements.

### 8) Player identity foundation (pre-auth)
- Added Player entity and ownership relation to Company.
- Added `X-Player-Handle`-based temporary identity.
- Ownership enforcement for company-scoped actions with 403 semantics.
- UI switched to owned-company sourcing.

### 9) Finance module
- Added finance ledger/summary read APIs (ownership-protected).
- Added finance page with breakdown and reconciliation checks.

### 10) Contracts v1
- Added contract generation/expiry, accept/fulfill APIs, and UI flows.
- Added fulfillment transfers with inventory/cash/ledger consistency.
- Added contract tests across sim/API/worker flows.

### 11) Research v1
- Added research nodes/prereqs/company research/research jobs.
- Added research payment ledger entries.
- Added company recipe unlock gating via research completion.
- Production now checks recipe unlocks.
- Added research API and UI page.

### 12) Market Analytics v1
- Added per-tick candles (OHLC/volume/VWAP) from real trades.
- Added candles API + analytics summary API + analytics UI.
- Added unit + API integration tests for candle correctness.

### 13) Regions v1
- Added Region model, company region, region-scoped inventory key.
- Added Shipment model and logistics services/APIs/UI.
- Deterministic travel matrix and shipment fees with ledger entries.
- Tick integration for shipment delivery.

### 14) Regional Markets v2 (latest major delivered step)
- Market orders now region-scoped.
- Trades now region-scoped.
- Candles now region-scoped with unique `(itemId, regionId, tick)`.
- Matching runs per `(regionId, itemId)`.
- Order placement enforces company home region (remote placement forbidden).
- API updated with region filters/defaults and region fields in DTOs.
- Market and Analytics UI updated with region selectors.
- Logistics UI gained arbitrage helper panel (read-only by region price comparison).
- Added regional unit/integration coverage and passed all gates.

## Important Correctness Discussions Captured in Session

- Cash accounting model consistency was challenged and validated repeatedly.
- Price-improvement/refund semantics were explicitly called out as drift risk.
- Ledger semantics were hardened to avoid ambiguous reserve release interpretation.
- Invariant scanner coverage and payload capping were discussed and improved.

## Environment and Execution Notes Seen During Session

- Postgres/Redis started via docker compose.
- Early failures due to missing `DATABASE_URL` were resolved with env setup.
- One migration-shadow issue (`P3006`) was encountered earlier in the timeline.
- Prisma client generation on Windows required binary engine setting in one phase.
- Port-in-use (`EADDRINUSE 3000`) occurred in API dev run at one point.

## Verification Gates Repeatedly Run During Session

Commonly run and expected-green commands:
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm api:test`
- `pnpm web:typecheck`
- `pnpm web:lint`
- `pnpm web:build`
- `pnpm worker:once -- --ticks N`

## Git/Workspace State Signals During Session

- Multiple points with large uncommitted working sets (for example 28, 39, 56, 64 files) were reported by user.
- A major feature commit was created near the end:
  - `dd82663 feat: add regions logistics and regional markets v2`
- After that commit, `git status` was clean at that moment.

## Documentation Context Events

- `docs/project/ROADMAP.md` was previously a task-style brief.
- It was later replaced/updated to a higher-level roadmap format.
- A later read-only check concluded it is now largely aligned with implemented code state, with expected high-level abstraction.

## Active Behavior/Policy Context from User During Session

- "run the commands yourself" was explicitly requested.
- "never kill processes" was explicitly requested.
- Requested strict adherence to AGENTS and design-guideline workflow.

## Known Current Shape of the Product (from session progression)

- Authoritative API + worker-driven tick simulation.
- Economy systems: market, production, contracts, research, finance, logistics.
- Region-aware inventory and now region-aware market execution/analytics.
- Pre-auth identity model via `X-Player-Handle` with ownership guards.
- Dark ERP UI with module pages and live health polling.

## Notes on this dump

- This context file is session-derived and intentionally broad.
- It reflects the cumulative interaction history and implementation milestones discussed/executed during the session.

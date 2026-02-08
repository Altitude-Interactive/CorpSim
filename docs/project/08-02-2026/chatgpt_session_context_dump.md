# CorpSim – Session Context Dump (ChatGPT)

## Project Overview
CorpSim is a web-based economic/management simulation game heavily inspired by SimCompanies. The project focuses on realistic ERP-style management gameplay including economy simulation, production, logistics, finance, analytics, and long-term corporate progression.

Stack principles:
- Deterministic tick-based backend simulation
- Modular architecture (apps/* + packages/* monorepo)
- PostgreSQL + Prisma
- Worker-driven simulation loop
- Next.js frontend with ShadCN dark ERP UI
- Docker Compose local infra (Postgres, Redis)
- Strong invariants, ledger accounting, auditability

Core philosophy:
- No temporary hacks
- Professional modular code
- Simulation-first backend
- UI reflects ERP realism

---

## Current Implemented Systems

### Economy Core
- Companies, items, recipes, inventory
- Tick-driven simulation engine
- Ledger accounting (cash + reserved cash semantics)
- Deterministic matching engine
- Market order placement/cancelation
- Trade settlement with ledger entries

### Production System
- Production jobs with input reservation
- Tick completion pipeline
- Recipe unlocking via research
- Bot production integration

### Contracts System
- Procedural contract generation per tick
- Accept/fulfill lifecycle
- Settlement ledger integration

### Research System
- Tech tree nodes
- Company research progress tracking
- Recipe unlock gating
- Research ledger payments

### Player / Ownership Model
- Player entity
- Company ownership enforcement
- Middleware identity via header (pre-auth phase)
- Ownership checks in API

### Worker + Bots
- Continuous tick worker loop
- Liquidity bots
- Producer bots
- Deterministic scheduling
- Invariant scanning

### Analytics
- Tick candles (OHLC + volume + VWAP)
- Market KPI summaries
- ERP analytics dashboard UI

### Regions + Logistics
- Regions seeded (CORE / INDUSTRIAL / FRONTIER)
- Region-scoped inventory
- Shipment system:
  - transport time matrix
  - shipment fees
  - delivery via ticks
- Logistics UI module

### Finance Module
- Ledger browsing
- Financial summaries
- Reconciliation panels

### Web UI
Dark ERP dashboard built with:
- ShadCN components
- Sidebar navigation
- Modules:
  - Market
  - Production
  - Contracts
  - Research
  - Finance
  - Analytics
  - Logistics

---

## Infrastructure

Monorepo structure:
- apps/api → NestJS API
- apps/web → Next.js frontend
- apps/worker → tick simulation worker
- packages/db → Prisma schema + seeds
- packages/sim → simulation engine

Tooling:
- pnpm workspaces
- TypeScript strict
- Vitest tests
- ESLint
- Docker Compose for Postgres + Redis

Environment:
- DATABASE_URL required
- Worker config env variables
- Tick interval configurable

---

## Simulation Design Principles

- Tick-driven deterministic world
- Strong invariants (no negative cash/inventory)
- Explicit ledger accounting
- Idempotent tick steps
- Transactional writes only in simulation layer
- API is thin boundary

Order of tick pipeline (current):
1. Bot actions
2. Production completion
3. Research completion
4. Market matching + settlement
5. Shipment delivery
6. Contract lifecycle
7. Candle aggregation
8. Finalize tick

---

## UI Philosophy

- ERP-style realism
- Dark-only theme
- Dashboard-centric navigation
- Data density prioritized over visuals
- Analytics-first decision tools

---

## Immediate Next Roadmap Candidates

### Economy Depth
- Regional markets
- Arbitrage mechanics
- Warehousing capacity
- Storage costs
- Product quality tiers
- Spoilage mechanics

### Business Simulation
- Workforce simulation
- Marketing systems
- Corporate finance tools
- Loans / credit
- Reputation systems

### Multiplayer Evolution
- Real authentication
- Player corporations
- Alliances / competition

### Technical Evolution
- Observability
- Horizontal scaling workers
- Replayable ticks
- Backtesting

---

## Long-Term Vision

- Persistent player-driven economy
- Corporate strategy simulation depth
- Modding ecosystem
- Public release readiness

---

## Notes Specific to This Session

- Focus on modular professional architecture
- Avoid premature complexity but maintain scalability
- Emphasis on realistic economy simulation
- ERP-style UX direction confirmed
- Regions introduced before regional markets
- Analytics introduced for decision feedback
- Ownership boundary introduced pre-auth

---

End of session context dump.

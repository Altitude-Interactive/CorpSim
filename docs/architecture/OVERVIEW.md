# CorpSim Architecture Overview

## System Architecture

CorpSim is a **backend-authoritative management/economy simulation** built as a discrete-tick simulation with deterministic processing. The architecture follows a strict separation between presentation (web UI), orchestration (API), and domain logic (simulation engine).

## High-Level Components

```
┌─────────────┐
│   Web UI    │  Next.js React App (Read + Request Actions)
│  (apps/web) │  - Dashboard, charts, controls
└──────┬──────┘  - NO client-side mutations
       │
       │ HTTP/REST
       │
┌──────▼──────┐
│   API       │  NestJS HTTP Server (Validation + Delegation)
│ (apps/api)  │  - Thin controllers
└──────┬──────┘  - Delegates to sim package
       │
       │ Function calls
       │
┌──────▼───────────────┐
│  Simulation Engine   │  Domain Logic (packages/sim)
│  (packages/sim)      │  - Tick orchestration
└──────┬───────────────┘  - Business rules
       │                   - Economic invariants
       │
┌──────▼──────┐
│  Database   │  PostgreSQL + Prisma
│ (packages/db)│  - Authoritative state
└─────────────┘  - Transactions

       ┌───────────────┐
       │    Worker     │  Background Processor
       │ (apps/worker) │  - Tick advancement
       └───────────────┘  - Bot execution
              │
              │ BullMQ + Redis
              │
       ┌──────▼──────┐
       │    Queue    │  Job Scheduling
       └─────────────┘  - Repeatable ticks
```

## Core Design Principles

### 1. Server Authority
- **All state mutations happen server-side**
- Client never creates money, items, or jobs directly
- API validates all state transitions
- Web UI only reads and requests actions

### 2. Deterministic Simulation
- **Time is discrete**: Integer tick counter
- Simulation reproducible from DB state + tick processing
- Fixed execution order for all subsystems
- No randomness in core logic (deterministic prices, demand, etc.)
- Fast-forward supported (advance N ticks safely)

### 3. Transaction Boundaries
All economic state transitions are transactional:
- Each tick advance is a single database transaction
- Placing orders reserves inventory/cash atomically
- Matching trades transfers value atomically
- Production completion consumes inputs and produces outputs atomically
- Rollback on any failure preserves consistency

### 4. Economic Invariants
Strict ledger integrity enforced:
- No negative inventory (unless explicitly modeled)
- No negative cash (unless explicitly modeled)
- Reserved amounts never exceed total amounts
- Every value movement recorded in ledger
- Reservation system prevents double-booking

### 5. Modularity and Layering
- **Domain logic** lives in service modules (`packages/sim`)
- **No business logic in controllers** (API is thin delegation layer)
- **No duplicated logic** between API and worker
- Clear separation: Web (presentation) → API (validation) → Sim (domain)

## Related Documentation

- [Simulation Pipeline Flow](./SIMULATION_PIPELINE.md) - Detailed tick execution
- [Economic Invariants](./ECONOMIC_INVARIANTS.md) - Financial rules and constraints
- [System Boundaries](./SYSTEM_BOUNDARIES.md) - Module responsibilities
- [AGENTS.md](../agents/AGENTS.md) - Development rules and conventions
- [ADR 0001](../adr/0001-worker-runtime-bullmq.md) - Worker runtime decision

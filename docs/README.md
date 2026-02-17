# CorpSim Documentation

## Quick Navigation

### Architecture & Design
- **Architecture documentation** → [docs/architecture/](./architecture/)
  - [Architecture Overview](./architecture/OVERVIEW.md) - High-level system design
  - [Simulation Pipeline Flow](./architecture/SIMULATION_PIPELINE.md) - Detailed tick execution
  - [Economic Invariants](./architecture/ECONOMIC_INVARIANTS.md) - Financial rules and constraints
  - [System Boundaries](./architecture/SYSTEM_BOUNDARIES.md) - Module responsibilities and layering
- **Coding rules** → [docs/agents/AGENTS.md](./agents/AGENTS.md)
- **UI design system** → [docs/design/DESIGN_GUIDELINES.md](./design/DESIGN_GUIDELINES.md)

### Project Management
- **Project files (Agents are forbidden to write in there)** → [docs/project/ROADMAP.md](./project/ROADMAP.md)

### Architecture Decisions
- **Architecture decisions** → [docs/adr/0001-worker-runtime-bullmq.md](./adr/0001-worker-runtime-bullmq.md)

## Documentation Structure

```
docs/
├── README.md                    # This file
├── architecture/                # System architecture
│   ├── OVERVIEW.md              # High-level design, principles
│   ├── SIMULATION_PIPELINE.md   # Tick-by-tick execution flow
│   ├── ECONOMIC_INVARIANTS.md   # Financial integrity rules
│   └── SYSTEM_BOUNDARIES.md     # Module responsibilities
├── agents/                      # Agent/bot documentation
│   └── AGENTS.md                # Development rules (source of truth)
├── design/                      # UI/UX design
│   └── DESIGN_GUIDELINES.md     # Design system, components
├── adr/                         # Architecture Decision Records
│   └── 0001-worker-runtime-bullmq.md
└── project/                     # Project management
    ├── GET_STARTED.md
    ├── ROADMAP.md
    └── DOKPLOY_*                # Deployment guides
```

## For Developers

### Getting Started
1. Read [AGENTS.md](./agents/AGENTS.md) for development rules
2. Review [Architecture Overview](./architecture/OVERVIEW.md) for system design
3. Follow [GET_STARTED.md](./project/GET_STARTED.md) for local setup

### Understanding the Codebase
1. Start with [System Boundaries](./architecture/SYSTEM_BOUNDARIES.md) to understand module responsibilities
2. Read [Simulation Pipeline](./architecture/SIMULATION_PIPELINE.md) to understand tick execution
3. Review [Economic Invariants](./architecture/ECONOMIC_INVARIANTS.md) for financial rules
4. Explore JSDoc comments in source files for implementation details

### Working on Features
1. Consult [AGENTS.md](./agents/AGENTS.md) for golden rules (maintenance mode, releases, etc.)
2. Check [ROADMAP.md](./project/ROADMAP.md) for planned features
3. Follow module boundaries defined in [System Boundaries](./architecture/SYSTEM_BOUNDARIES.md)
4. Write tests for domain logic changes

### Working on UI
1. Follow [Design Guidelines](./design/DESIGN_GUIDELINES.md) for UI patterns
2. Use ShadCN components
3. Dark theme only
4. Desktop-first, ERP-style

## For System Administrators

### Deployment
- See deployment guides in `docs/project/DOKPLOY_*`
- Review [Architecture Overview](./architecture/OVERVIEW.md) for service dependencies
- Understand worker scaling via [ADR 0001](./adr/0001-worker-runtime-bullmq.md)

### Monitoring
- Check simulation health via invariant scans
- Monitor tick processing latency
- Watch queue depth and lag
- Track cash/inventory balances

### Troubleshooting
- Invariant violations: Check [Economic Invariants](./architecture/ECONOMIC_INVARIANTS.md)
- Tick processing issues: Review [Simulation Pipeline](./architecture/SIMULATION_PIPELINE.md)
- Worker coordination: See [ADR 0001](./adr/0001-worker-runtime-bullmq.md)

## Source Code Documentation

In addition to this documentation, **all core simulation systems are documented with comprehensive JSDoc comments** in the source code:

### Simulation Engine (`packages/sim/src/`)
- **services/tick-engine.ts** - Tick orchestration and pipeline
- **services/market-matching.ts** - Order matching and settlement
- **services/market-orders.ts** - Order placement and cancellation
- **services/production.ts** - Production lifecycle
- **services/research.ts** - Research progression
- **services/contracts.ts** - Contract lifecycle
- **services/shipments.ts** - Logistics and shipping
- **services/workforce.ts** - Workforce management
- **bots/bot-runner.ts** - Bot coordination engine
- **domain/errors.ts** - Domain error types
- **domain/reservations.ts** - Two-phase resource locking
- And many more...

### Worker (`apps/worker/src/`)
- **main.ts** - Entry point and orchestration
- **worker-loop.ts** - Tick processing with retry logic
- **queue-runtime.ts** - BullMQ distributed scheduling
- **simulation-control.ts** - Control flags and safety

### API (`apps/api/src/`)
- Various controller modules (see source code for details)

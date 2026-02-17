# System Boundaries and Module Responsibilities

## Overview

CorpSim maintains clear boundaries between layers and modules. This document defines the responsibilities of each component and the rules governing their interactions.

## Layer Architecture

```
┌─────────────────────────────────────────────────┐
│         Presentation Layer (apps/web)            │
│  - React components                              │
│  - Charts, tables, forms                         │
│  - State management                              │
│  - NO business logic                             │
└────────────────┬────────────────────────────────┘
                 │ HTTP/REST
┌────────────────▼────────────────────────────────┐
│         API Layer (apps/api)                     │
│  - Route handlers                                │
│  - Input validation (DTOs)                       │
│  - Ownership checks                              │
│  - Delegates to sim                              │
│  - NO domain logic                               │
└────────────────┬────────────────────────────────┘
                 │ Function calls
┌────────────────▼────────────────────────────────┐
│         Domain Layer (packages/sim)              │
│  - Business rules                                │
│  - Economic invariants                           │
│  - State transitions                             │
│  - Pure logic (no HTTP)                          │
└────────────────┬────────────────────────────────┘
                 │ Prisma ORM
┌────────────────▼────────────────────────────────┐
│         Data Layer (packages/db)                 │
│  - Schema definitions                            │
│  - Migrations                                    │
│  - Seed data                                     │
└─────────────────────────────────────────────────┘
```

## Module Responsibilities

### packages/sim - Simulation Engine

#### ✅ Responsibilities
- **Domain logic**: All business rules and economic calculations
- **Invariant enforcement**: Validate and assert constraints
- **State transitions**: Orchestrate changes (tick pipeline, order placement, etc.)
- **Determinism**: Ensure reproducible behavior
- **Error handling**: Throw typed domain errors

#### ❌ Not Responsible For
- HTTP request handling
- Authentication/authorization
- Input sanitization (beyond domain validation)
- Response formatting
- Logging (except critical invariant violations)

#### Key Modules
- `services/tick-engine.ts` - Tick orchestration
- `services/production.ts` - Production lifecycle
- `services/market-matching.ts` - Trade execution
- `services/market-orders.ts` - Order placement
- `services/research.ts` - Tech tree progression
- `services/contracts.ts` - Contract lifecycle
- `services/shipments.ts` - Logistics
- `services/workforce.ts` - Workforce management
- `bots/` - Bot strategies
- `domain/` - Errors and reservations

#### Dependencies
- `@prisma/client` - Database access
- `@corpsim/shared` - Shared types
- **No** HTTP libraries, no framework dependencies

---

### apps/api - HTTP API Server

#### ✅ Responsibilities
- **Route handling**: Define HTTP endpoints
- **Input validation**: DTO validation (Zod or class-validator)
- **Ownership checks**: Assert player owns resource
- **Delegation**: Call sim services
- **Response mapping**: Convert domain models to DTOs
- **Error mapping**: Convert domain errors to HTTP status codes
- **Authentication**: Validate player identity (future)

#### ❌ Not Responsible For
- Business logic (delegates to sim)
- Economic calculations
- Direct database mutations (sim handles transactions)
- Tick advancement (worker's job)

#### Module Structure
```
apps/api/src/
├── world/          # World state, tick info
├── market/         # Market orders, trades
├── production/     # Production jobs
├── research/       # Research
├── contracts/      # Contracts
├── shipments/      # Shipments
├── workforce/      # Workforce
├── finance/        # Ledger, analytics
├── players/        # Player identity
└── common/         # Shared (guards, filters, DTOs)
```

#### Controller Pattern
```typescript
@Controller('production')
export class ProductionController {
  constructor(private prisma: PrismaClient) {}

  @Post('jobs')
  async createJob(@Body() dto: CreateProductionJobDto, @Req() req) {
    // 1. Extract player from request
    const playerId = await resolvePlayerByHandle(prisma, req.user.handle);

    // 2. Validate ownership
    await assertPlayerOwnsCompany(prisma, playerId, dto.companyId);

    // 3. Delegate to sim
    const job = await createProductionJob(prisma, {
      companyId: dto.companyId,
      recipeId: dto.recipeId,
      quantity: dto.quantity
    });

    // 4. Map to DTO and return
    return mapJobToDto(job);
  }
}
```

#### Dependencies
- `@nestjs/common` - Framework
- `@prisma/client` - Database
- `@corpsim/sim` - Domain logic
- `@corpsim/shared` - Shared types

---

### apps/worker - Background Processor

#### ✅ Responsibilities
- **Tick advancement**: Execute simulation ticks
- **Job processing**: BullMQ worker
- **Lease management**: Coordinate scheduler/processor roles
- **Invariant monitoring**: Scan for violations
- **Control enforcement**: Pause bots, stop processing
- **Graceful shutdown**: Handle signals (SIGINT/SIGTERM)

#### ❌ Not Responsible For
- HTTP request handling
- User authentication
- API response formatting
- Direct client interaction

#### Key Modules
- `main.ts` - Entry point, signal handling
- `worker-loop.ts` - Tick processing with retry logic
- `queue-runtime.ts` - BullMQ setup and coordination
- `simulation-control.ts` - Control flags
- `simulation-lease.ts` - Distributed locking

#### Dependencies
- `@prisma/client` - Database
- `@corpsim/sim` - Domain logic
- `bullmq` - Job queue
- `ioredis` - Redis client

---

### apps/web - Frontend UI

#### ✅ Responsibilities
- **Presentation**: Display simulation state
- **User input**: Forms, buttons, controls
- **Data fetching**: Call API endpoints
- **State management**: Local UI state (selected company, filters, etc.)
- **Charts/graphs**: Visualize data (price history, KPIs)

#### ❌ Not Responsible For
- Business logic (read-only, delegates actions to API)
- Data mutation (only requests actions)
- Validation beyond UX (server validates)
- Simulation execution

#### Module Structure
```
apps/web/src/
├── app/            # Next.js app routes
├── components/     # React components
├── lib/            # API client, utilities
└── hooks/          # Custom React hooks
```

#### Data Flow
```typescript
// Read
Component → fetch API → Display data

// Write
Component → Submit form → API request → Await response → Refresh data
```

#### Dependencies
- `next` - Framework
- `react` - UI library
- `@corpsim/shared` - Shared types (DTOs)
- **No** direct database access
- **No** direct sim package access

---

### packages/db - Database Layer

#### ✅ Responsibilities
- **Schema definition**: Prisma schema (single source of truth)
- **Migrations**: Database schema changes
- **Seed scripts**: Initial data, dev fixtures
- **Utilities**: Prisma client factory

#### ❌ Not Responsible For
- Business logic
- Query optimization (responsibility of callers)
- Transaction orchestration (sim handles)

#### Key Files
- `prisma/schema.prisma` - Schema definition
- `prisma/migrations/` - Migration history
- `prisma/seed.ts` - Seed script
- `src/index.ts` - Client factory

#### Dependencies
- `@prisma/client` - ORM client
- `prisma` - CLI tool

---

### packages/shared - Shared Code

#### ✅ Responsibilities
- **TypeScript types**: Interfaces, enums
- **Validation schemas**: Zod schemas for DTOs
- **Constants**: Item codes, specializations, config defaults
- **Utility functions**: Pure helpers (no side effects)

#### ❌ Not Responsible For
- Server secrets (API keys, DB credentials)
- Business logic
- Database access
- HTTP handling

#### Key Modules
- `src/types/` - TypeScript types
- `src/schemas/` - Zod validation
- `src/constants/` - Constants, enums
- `src/utils/` - Pure utility functions

#### Dependencies
- `zod` - Validation
- **No** database, HTTP, or framework deps

---

## Cross-Cutting Concerns

### Logging
- **API**: HTTP request/response logs
- **Worker**: Tick iteration results, errors
- **Sim**: Critical invariant violations only
- **Structured logging**: JSON format with context

### Error Handling
```
Domain Error → Sim (throw typed error)
           ↓
API Layer (catch, map to HTTP status)
           ↓
Client (display user-friendly message)
```

### Transaction Management
- **Sim**: Uses Prisma transactions for atomicity
- **API**: Delegates to sim (no direct transaction control)
- **Worker**: Delegates to sim (tick pipeline is one transaction)

### Authentication (Future)
- **API**: Verify JWT/session, resolve player
- **Sim**: Receives playerId, no auth logic
- **Worker**: No auth (background process)

### Authorization
- **API**: Assert player owns resource before delegating
- **Sim**: Receives validated playerId, trusts API layer
- **Worker**: No authorization (system actor)

---

## Module Interaction Rules

### 1. Sim → Database
✅ **Allowed**: Direct Prisma queries and transactions
❌ **Forbidden**: Raw SQL (except justified optimizations)

### 2. API → Sim
✅ **Allowed**: Call sim service functions
❌ **Forbidden**: Bypass sim and mutate database directly

### 3. Worker → Sim
✅ **Allowed**: Call tick advancement functions
❌ **Forbidden**: Bypass sim, duplicate logic

### 4. Web → API
✅ **Allowed**: HTTP requests via fetch/axios
❌ **Forbidden**: Direct database access, direct sim calls

### 5. API ↔ Worker
✅ **Allowed**: Shared database state
❌ **Forbidden**: Direct RPC calls (communicate via database or queue)

### 6. Shared → All
✅ **Allowed**: Import types, constants, utils
❌ **Forbidden**: Shared importing from apps/packages (dependency inversion)

---

## Testing Boundaries

### Unit Tests (packages/sim)
- Test domain logic in isolation
- Mock Prisma client
- Focus on invariants, calculations, state transitions

### Integration Tests (apps/api/test)
- Test end-to-end flows
- Real database (test instance)
- API endpoints → sim services → database

### E2E Tests (Future)
- Test full stack (web → API → sim → database)
- Browser automation
- Real user scenarios

---

## Migration Between Layers

### Data Flow Patterns

#### Read Path
```
Client Request → API → Sim Read Service → Prisma → Database
             ← DTO ← Domain Model ← Prisma Model ←
```

#### Write Path
```
Client Request → API → Validate → Ownership Check → Sim Service
                                                         ↓
                                                   Prisma Transaction
                                                         ↓
                                                    Database
                                                         ↓
                                                   Commit/Rollback
                                                         ↓
             ← DTO ← Domain Model ←
```

---

## Related Documentation

- [Architecture Overview](./OVERVIEW.md) - System design
- [Simulation Pipeline](./SIMULATION_PIPELINE.md) - Tick execution
- [Economic Invariants](./ECONOMIC_INVARIANTS.md) - Financial rules
- [AGENTS.md](../agents/AGENTS.md) - Development guidelines

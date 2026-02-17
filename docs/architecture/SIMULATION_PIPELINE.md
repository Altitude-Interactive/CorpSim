# Simulation Pipeline Flow

## Overview

The simulation advances in discrete **ticks** (integer time units). Each tick represents a fixed time interval during which all simulation subsystems execute in a deterministic, fixed order. This document describes the tick pipeline stages, their responsibilities, and execution guarantees.

## Tick Pipeline Architecture

```
Tick N Start
    │
    ├─ [Transaction Begin]
    │
    ├─ [1] Bot Actions
    │     └─ Liquidity bots place orders
    │     └─ Producer bots start profitable jobs
    │
    ├─ [2] Production Completions
    │     └─ Complete jobs where dueTick ≤ currentTick
    │     └─ Consume inputs, generate outputs
    │
    ├─ [3] Research Completions
    │     └─ Complete research jobs
    │     └─ Unlock recipes
    │
    ├─ [4] Market Matching
    │     └─ Match buy/sell orders
    │     └─ Execute trades, transfer cash/inventory
    │
    ├─ [5] Shipment Deliveries
    │     └─ Deliver shipments that arrived
    │     └─ Transfer inventory to destination
    │
    ├─ [6] Workforce Updates
    │     └─ Process hiring arrivals
    │     └─ Deduct salaries
    │     └─ Update efficiency
    │
    ├─ [7] Demand Sink
    │     └─ NPCs consume inventory
    │     └─ Remove items from economy
    │
    ├─ [8] Contract Lifecycle
    │     └─ Expire old contracts
    │     └─ Generate new contracts
    │
    ├─ [9] Market Candles
    │     └─ Aggregate trades into OHLCV candles
    │
    ├─ [10] World State Update
    │     └─ Increment tick counter
    │     └─ Increment lock version
    │     └─ Record lastAdvancedAt timestamp
    │
    ├─ [Transaction Commit]
    │
Tick N+1 Start
```

## Stage Details

### Stage 1: Bot Actions
**Module**: `packages/sim/src/bots/bot-runner.ts`

**Purpose**: NPCs participate in economy by placing orders and starting production.

**Operations**:
- Load NPC companies (limited by botCount config)
- Infer strategy per company (LIQUIDITY or PRODUCER)
- **Liquidity bots**:
  - Calculate reference prices (trades, order book, defaults)
  - Place buy orders below reference
  - Place sell orders above reference
  - Maintain market depth
- **Producer bots**:
  - Evaluate profitable recipes
  - Start production if margin > threshold

**Determinism**:
- Companies sorted by code
- Reference prices resolved in consistent order
- No randomness in strategy execution

**Side Effects**:
- Market orders created (cash/inventory reserved)
- Production jobs created (inventory reserved)

---

### Stage 2: Production Completions
**Module**: `packages/sim/src/services/production.ts`

**Purpose**: Complete manufacturing jobs that reached their due tick.

**Operations**:
- Query jobs where `dueTick <= currentTick AND status = IN_PROGRESS`
- For each job:
  - Validate reserved inputs still available
  - Consume inputs (decrement quantity and reservedQuantity)
  - Generate outputs (upsert inventory)
  - Mark job COMPLETED
  - Create ledger entry

**Determinism**:
- Jobs sorted by `dueTick ASC, createdAt ASC`
- Duration calculated with workforce modifiers (deterministic)

**Side Effects**:
- Inventory consumed and produced
- Job status updated
- Ledger entries created

**Invariants**:
- Input/output atomicity (all or nothing)
- No partial completions
- Reserved quantities released

---

### Stage 3: Research Completions
**Module**: `packages/sim/src/services/research.ts`

**Purpose**: Complete research jobs and unlock recipes.

**Operations**:
- Query jobs where `tickCompletes <= currentTick AND status = RUNNING`
- For each job:
  - Mark job COMPLETED
  - Mark company_research COMPLETED
  - Upsert recipe unlocks for company

**Determinism**:
- Jobs sorted by `tickCompletes ASC, createdAt ASC`
- Duration calculated with workforce modifiers

**Side Effects**:
- Research status updated
- Recipes unlocked for company
- Job status updated

**Invariants**:
- Prerequisites must be completed before start
- Cash deducted upfront (no refund on completion)

---

### Stage 4: Market Matching
**Module**: `packages/sim/src/services/market-matching.ts`

**Purpose**: Match buy and sell orders, execute trades.

**Operations**:
- For each item/region pair:
  - Load buy orders (sorted highest price first, then time)
  - Load sell orders (sorted lowest price first, then time)
  - Match while buy price ≥ sell price
  - Execute trade:
    - Calculate execution price (resting order's price)
    - Transfer inventory from seller to buyer
    - Transfer cash from buyer to seller
    - Update order remaining quantities
    - Create trade record
    - Create ledger entries (both sides)

**Determinism**:
- Price-time priority (fixed sort order)
- Resting order price rule
- Same market state → identical trades

**Side Effects**:
- Cash transferred between companies
- Inventory transferred between companies
- Orders updated or filled
- Trades created
- Ledger entries created

**Invariants**:
- Pre-settlement validation (reserved amounts sufficient)
- Post-settlement validation (no negative balances)
- Atomic transfers (all or nothing)

---

### Stage 5: Shipment Deliveries
**Module**: `packages/sim/src/services/shipments.ts`

**Purpose**: Complete inter-region shipments that arrived.

**Operations**:
- Query shipments where `tickArrives <= currentTick AND status = IN_TRANSIT`
- For each shipment:
  - Validate shipment still valid
  - Upsert destination inventory (add quantity)
  - Mark shipment DELIVERED

**Determinism**:
- Shipments sorted by `tickArrives ASC, createdAt ASC`
- Travel time calculated with workforce modifiers

**Side Effects**:
- Inventory created/incremented at destination
- Shipment status updated

**Invariants**:
- Atomic delivery (no partial transfers)
- Fees non-refundable (already deducted at creation)

---

### Stage 6: Workforce Updates
**Module**: `packages/sim/src/services/workforce.ts`

**Purpose**: Process workforce changes, deduct salaries, update efficiency.

**Operations**:
- **Hiring arrivals**:
  - Query pending capacity deltas where `tickEffective <= currentTick`
  - Apply capacity changes
  - Delete pending deltas
- **Salary deduction**:
  - Calculate salary per company (capacity × baseSalary × regionModifier)
  - Deduct from cash
  - Create ledger entry
- **Efficiency updates**:
  - Apply penalties (layoffs, hiring shock, low corporate, salary shortfall)
  - Apply recovery (corporate allocation)
  - Clamp to [0, 10000] bps

**Determinism**:
- Salary calculation uses fixed formulas
- Efficiency updates use integer arithmetic
- No randomness

**Side Effects**:
- Workforce capacity updated
- Cash decremented (salaries)
- Efficiency adjusted
- Ledger entries created

**Invariants**:
- Capacity ≥ 0
- Efficiency in [0, 10000] bps
- Allocation percentages sum to 100%

---

### Stage 7: Demand Sink
**Module**: `packages/sim/src/services/demand-sink.ts`

**Purpose**: NPCs consume inventory to create scarcity.

**Operations**:
- For each configured item:
  - Find NPC companies with inventory
  - Calculate demand quantity (base + variability via hash)
  - Decrement inventory until demand met
  - Process companies in sorted order

**Determinism**:
- Stable hash function per company+item
- Same seed → same demand quantities
- Companies sorted by id

**Side Effects**:
- Inventory decremented (removed from economy)

**Invariants**:
- Only consumes available (non-reserved) inventory
- Cannot go negative

---

### Stage 8: Contract Lifecycle
**Module**: `packages/sim/src/services/contracts.ts`

**Purpose**: Expire old contracts, generate new ones.

**Operations**:
- **Expiration**:
  - Mark contracts where `tickExpires <= currentTick` as EXPIRED
- **Generation**:
  - For each NPC buyer:
    - Determine items to offer
    - Calculate price (base ± variance, deterministic)
    - Calculate quantity (base + tick offset)
    - Create contract records

**Determinism**:
- Price variance: `(tick + sequence) % 2` for direction
- Quantity: `base + ((tick + sequence) % 3)`
- No randomness

**Side Effects**:
- Expired contracts marked
- New contracts created

**Invariants**:
- NPC companies only as buyers
- Prices based on fallback tables + recent trades

---

### Stage 9: Market Candles
**Module**: `packages/sim/src/services/market-candles.ts`

**Purpose**: Aggregate trades into OHLCV candles for analytics.

**Operations**:
- Fetch trades for current tick
- Group by item+region
- Sort trades by timestamp
- Compute:
  - Open: first trade price
  - High: max trade price
  - Low: min trade price
  - Close: last trade price
  - Volume: sum of quantities
  - Trade count
  - VWAP: volume-weighted average

**Determinism**:
- Trades sorted by createdAt + id
- Integer arithmetic (no floating point)

**Side Effects**:
- Candle records upserted

**Invariants**:
- Trade must have positive price and quantity
- Tick must be non-negative

---

### Stage 10: World State Update
**Module**: `packages/sim/src/services/tick-engine.ts`

**Purpose**: Finalize tick advancement.

**Operations**:
- Increment `currentTick` by 1
- Increment `lockVersion` by 1
- Update `lastAdvancedAt` timestamp
- Validate optimistic lock (updateMany with where clause)

**Determinism**:
- Tick always increments by exactly 1
- Lock version always increments by exactly 1

**Side Effects**:
- World tick state updated

**Invariants**:
- Lock version check prevents concurrent advances
- Tick sequence is gapless (0, 1, 2, 3, ...)

---

## Transaction Guarantees

### All-or-Nothing Semantics
- Entire tick pipeline executes in **one database transaction**
- If any stage fails, entire tick rolls back
- No partial tick advances possible
- State is consistent before and after each tick

### Optimistic Locking
- World state has `lockVersion` field
- Pre-execution: Read current lockVersion
- Post-execution: Update with `WHERE lockVersion = <expected>`
- If update count ≠ 1, another worker advanced tick → rollback and retry

### Idempotency
- Optional `executionKey` parameter
- Creates `SimulationTickExecution` record within transaction
- If key already exists, skip tick (return non-advanced result)
- Enables at-least-once job processing without duplicates

---

## Concurrency Model

### Multiple Workers
- Workers can run concurrently (scale horizontally)
- Optimistic locking prevents duplicate tick processing
- If conflict detected, worker retries with exponential backoff
- BullMQ ensures job-level idempotency

### Lease-Based Scheduling
- Single scheduler instance (via lease)
- Scheduler adds repeatable jobs to queue
- All workers (including scheduler) process jobs
- Scheduler lease can migrate if instance dies

---

## Error Handling

### Recoverable Errors
- **OptimisticLockConflictError**: Retry with backoff (up to 4 attempts)
- **Execution key conflict**: Return gracefully (idempotency)

### Non-Recoverable Errors
- **DomainInvariantError**: Validation failure (bad data or logic bug)
- **NotFoundError**: Referenced entity deleted concurrently
- These propagate and trigger transaction rollback

### Maintenance Mode
- Worker checks maintenance status between ticks
- If maintenance active, pause processing (graceful stop)
- Allows safe deployments without tick corruption

---

## Performance Characteristics

### Tick Processing Time
- **Typical**: 50-500ms per tick
- **Factors**: Bot count, order book depth, job completions
- **Batch size**: Configurable (default 1, max 10)

### Throughput
- **Single worker**: 2-10 ticks/second
- **Multiple workers**: Linear scaling with optimistic lock retries

### Bottlenecks
- Market matching (O(n²) worst case for order book depth)
- Production completions (O(n) for job count)
- Database transaction commit latency

---

## Related Documentation

- [Architecture Overview](./OVERVIEW.md) - High-level system design
- [Economic Invariants](./ECONOMIC_INVARIANTS.md) - Financial rules
- [System Boundaries](./SYSTEM_BOUNDARIES.md) - Module responsibilities
- [Tick Engine JSDoc](../../packages/sim/src/services/tick-engine.ts) - Implementation details

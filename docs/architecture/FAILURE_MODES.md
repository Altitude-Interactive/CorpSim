# Failure Modes and Recovery

## Overview

This document describes failure scenarios, detection mechanisms, and recovery procedures for the CorpSim persistent economy simulation. Given the backend-authoritative deterministic design, proper failure handling is critical to maintaining economic integrity.

## Critical Failure Categories

### 1. Tick Processing Failures

#### 1.1 Optimistic Lock Conflicts

**Scenario**: Multiple workers attempt to advance the same tick concurrently.

**Detection**:
- Prisma `updateMany` returns 0 rows updated
- `OptimisticLockConflictError` thrown by tick engine

**Recovery**:
```typescript
// Automatic: Exponential backoff retry (worker-loop.ts)
// - Initial backoff: 50ms
// - Max retries: 4 (default)
// - Backoff multiplier: 2x
// - Max backoff: 500ms
```

**Prevention**:
- World state uses `lockVersion` field
- Update checks: `WHERE lockVersion = <expected>`
- Only one worker succeeds per tick

**Impact**: None if retries succeed. If all retries fail, tick is not advanced (logged as error).

---

#### 1.2 Mid-Tick Transaction Rollback

**Scenario**: Database transaction fails during tick pipeline execution (stage 1-10).

**Detection**:
- Prisma transaction rejected
- Database connection error
- Constraint violation

**Recovery**:
```typescript
// Automatic: Complete rollback
// - No partial tick state persisted
// - World tick counter unchanged
// - All subsystem mutations reverted
```

**Prevention**:
- Entire tick in single transaction
- Pre-validation before mutations
- Domain invariant checks

**Impact**: Tick not advanced. Simulation pauses until next successful tick attempt. No data corruption.

---

#### 1.3 Tick Corruption (Partial Execution)

**Scenario**: Transaction commits with invalid state (programming bug).

**Detection**:
- Invariant scan after tick (`scanSimulationInvariants`)
- Detects:
  - Negative cash/inventory
  - Reserved > total
  - Invalid workforce allocations

**Recovery**:
```typescript
// Manual recovery required
// 1. Identify corruption tick via invariant violation logs
// 2. Stop processing (processingStopped flag)
// 3. Restore from backup before corruption tick
// 4. Fix bug in code
// 5. Resume from last good tick
```

**Prevention**:
- Comprehensive invariant validation
- Pre/post mutation assertions
- Automated invariant scans after each tick
- Control flags: `pauseBotsOnInvariantViolation`, `stopOnInvariantViolation`

**Impact**: Simulation stops automatically if configured. Requires manual intervention.

---

### 2. Worker Coordination Failures

#### 2.1 Scheduler Lease Loss

**Scenario**: Scheduler instance dies, another must take over.

**Detection**:
- Lease TTL expires in database
- Other worker acquires `simulation.tick.scheduler` lease

**Recovery**:
```typescript
// Automatic: Lease failover
// - New worker acquires scheduler lease
// - Resumes adding repeatable tick jobs
// - No duplicate scheduling (BullMQ deduplication)
```

**Prevention**:
- Lease-based scheduler coordination
- Heartbeat renewal (`schedulerLeaseRenewMs`)
- Single scheduler guarantees no duplicate jobs

**Impact**: Brief pause (seconds) during failover. Simulation resumes automatically.

---

#### 2.2 Queue Connectivity Loss

**Scenario**: Worker loses Redis connection.

**Detection**:
- BullMQ connection error events
- Job processing stops

**Recovery**:
```typescript
// Automatic: BullMQ retry/reconnect
// - Built-in Redis reconnection logic
// - Jobs remain queued in Redis
// - Workers resume processing after reconnect
```

**Prevention**:
- BullMQ handles transient failures
- Jobs persisted in Redis (durable)
- Configurable retry policies

**Impact**: Processing pauses until reconnection. Jobs queued during outage execute after recovery.

---

### 3. Economic Integrity Failures

#### 3.1 Cash Invariant Violation

**Scenario**: Company has negative cash or reserved > total.

**Detection**:
```typescript
// Invariant scan detects:
// - cashCents < 0
// - reservedCashCents < 0
// - reservedCashCents > cashCents
```

**Recovery**:
```typescript
// Manual investigation required
// 1. Check invariant violation logs for tick/company
// 2. Review ledger entries for company
// 3. Identify root cause (bug in market matching, production, etc.)
// 4. Restore from backup if corruption severe
// 5. Fix bug and deploy
```

**Prevention**:
- `assertCashInvariant()` before/after mutations
- Reservation system enforces available = total - reserved
- Ledger entries track all cash movements

**Impact**: Economic integrity compromised. Simulation should pause (via `stopOnInvariantViolation`).

---

#### 3.2 Inventory Invariant Violation

**Scenario**: Company has negative inventory or reserved > total.

**Detection**:
```typescript
// Invariant scan detects:
// - quantity < 0
// - reservedQuantity < 0
// - reservedQuantity > quantity
```

**Recovery**:
```typescript
// Manual investigation required (same as cash violation)
```

**Prevention**:
- `assertInventoryInvariant()` before/after mutations
- Reservation system for production inputs and sell orders
- Atomic consume/produce operations

**Impact**: Economic integrity compromised. Simulation should pause.

---

### 4. Desynchronization Scenarios

#### 4.1 Database vs. Application State Mismatch

**Scenario**: Cached state diverges from database (rare with current architecture).

**Detection**:
- Inconsistent query results
- Optimistic lock conflicts on fresh reads

**Recovery**:
```typescript
// Not applicable - current architecture is stateless
// - Workers are stateless (read from DB each tick)
// - API queries database directly (no cache)
// - No distributed cache layer
```

**Prevention**:
- Stateless worker design
- Database is single source of truth
- No application-level caching of mutable state

**Impact**: N/A - architecture prevents this scenario.

---

#### 4.2 Bot Strategy Desync

**Scenario**: Bot places orders/production inconsistent with strategy.

**Detection**:
- Unexpected market behavior
- Manual auditing of bot actions

**Recovery**:
```typescript
// No corruption - bots follow same rules as players
// 1. Review bot action logs
// 2. Fix bot strategy logic if buggy
// 3. Deploy fix
// 4. Bots self-correct on next execution
```

**Prevention**:
- Bots use same domain services as players
- Strategy determinism (hash-based cadence)
- Logged bot actions for auditing

**Impact**: Market imbalance possible, but no corruption. Self-correcting.

---

## Recovery Tools and Procedures

### Automated Recovery

**Optimistic Lock Retry** (worker-loop.ts):
```typescript
// Configured via:
// - maxConflictRetries: 4 (default)
// - initialBackoffMs: 50 (default)
// Exponential backoff: 50ms → 100ms → 200ms → 400ms
```

**Invariant-Based Safety** (queue-runtime.ts):
```typescript
// Configuration:
// - pauseBotsOnInvariantViolation: true (recommended)
// - stopOnInvariantViolation: false (development only)
//
// Actions:
// - Sets botsPaused flag → bots stop executing
// - Sets processingStopped flag → all processing halts
// - Logs violation tick and timestamp
```

**BullMQ Job Retry**:
```typescript
// Configured in queue-runtime.ts:
// - Job attempts (default: 3)
// - Exponential backoff
// - Dead letter queue for permanent failures
```

---

### Manual Recovery

**Database Backup/Restore**:
```bash
# Regular backups (recommended: hourly snapshots)
pg_dump -h localhost -U postgres corpsim > backup-tick-12345.sql

# Restore to specific tick
psql -h localhost -U postgres corpsim < backup-tick-12345.sql

# Verify world tick
psql -h localhost -U postgres -d corpsim \
  -c "SELECT currentTick, lockVersion FROM world_tick_state WHERE id = 1;"
```

**Control Flags**:
```bash
# Stop all processing
psql -h localhost -U postgres -d corpsim \
  -c "UPDATE simulation_control_state SET processing_stopped = true WHERE id = 1;"

# Pause bots only (other systems continue)
psql -h localhost -U postgres -d corpsim \
  -c "UPDATE simulation_control_state SET bots_paused = true WHERE id = 1;"

# Resume processing
psql -h localhost -U postgres -d corpsim \
  -c "UPDATE simulation_control_state SET processing_stopped = false, bots_paused = false WHERE id = 1;"
```

**Invariant Scan** (on-demand):
```typescript
// Via API or worker (not yet implemented as CLI)
// Manual query:
psql -h localhost -U postgres -d corpsim << 'SQL'
  SELECT * FROM company WHERE cash_cents < 0 OR reserved_cash_cents < 0 OR reserved_cash_cents > cash_cents;
  SELECT * FROM inventory WHERE quantity < 0 OR reserved_quantity < 0 OR reserved_quantity > quantity;
SQL
```

---

## Failure Mode Summary Table

| Failure | Detection | Recovery | Data Loss Risk | Downtime |
|---------|-----------|----------|----------------|----------|
| Optimistic lock conflict | Automatic | Automatic retry | None | Seconds (retry) |
| Transaction rollback | Automatic | Automatic rollback | None | None (idempotent) |
| Tick corruption | Invariant scan | Manual restore | Possible | Hours (investigation) |
| Scheduler lease loss | Automatic | Automatic failover | None | Seconds (failover) |
| Queue connectivity loss | BullMQ events | Automatic reconnect | None | Minutes (reconnect) |
| Cash/inventory violation | Invariant scan | Manual fix | Possible | Hours (investigation) |
| Database failure | N/A | Database HA/backup | Depends on backup age | Minutes to hours |

---

## Monitoring and Alerting

### Critical Metrics to Monitor

1. **Tick Processing Rate**
   - Target: 1-10 ticks/second (configurable)
   - Alert: <0.1 ticks/second for >5 minutes

2. **Optimistic Lock Conflict Rate**
   - Target: <5% of tick attempts
   - Alert: >20% conflict rate

3. **Invariant Violation Count**
   - Target: 0 violations
   - Alert: Any violation detected

4. **Queue Depth**
   - Target: <10 pending tick jobs
   - Alert: >100 pending jobs (backlog)

5. **Worker Health**
   - Target: At least 1 active worker
   - Alert: No workers processing for >1 minute

### Log Correlation

All economic actions include:
- `tickNumber` - When action occurred
- `companyId` - Which company
- `actionType` - What happened (PRODUCTION_START, BUY_SETTLEMENT, etc.)
- `correlationId` - For tracing multi-step operations

---

## Testing Failure Scenarios

### Integration Tests (Recommended)

```typescript
// Test optimistic lock conflict
// 1. Start two workers
// 2. Both attempt same tick
// 3. Verify one succeeds, one retries
// 4. Verify final tick state correct

// Test transaction rollback
// 1. Inject failure mid-tick (mock DB error)
// 2. Verify no partial state persisted
// 3. Verify tick counter unchanged

// Test invariant violation detection
// 1. Manually corrupt data (negative cash)
// 2. Run invariant scan
// 3. Verify violation detected and logged
// 4. Verify bots paused if configured
```

### Chaos Engineering (Future)

- Random worker kills
- Random Redis disconnects
- Inject network latency
- Corrupt random company data

---

## Deterministic Guarantees and Limitations

### What IS Deterministic

✅ **Same market state + tick → identical trades**
- Price-time priority matching (fixed sort order)
- Resting order price rule
- No randomness in matching algorithm

✅ **Same inputs + tick → identical production outputs**
- Workforce modifiers calculated deterministically
- No randomness in duration or output quantities

✅ **Same bot state + tick → identical bot actions**
- Cadence based on stable hash
- Reference prices from consistent sources
- No randomness in strategy logic

### What is NOT Deterministic (External Factors)

❌ **Concurrent player actions**
- Players can submit orders/jobs between ticks
- Order of player actions within same tick may vary
- Final tick state is deterministic, but intermediate state depends on player timing

❌ **Database query result ordering (without ORDER BY)**
- Always use explicit `ORDER BY` for deterministic processing
- Current implementation uses explicit ordering everywhere

❌ **Clock-based behavior (avoided)**
- Use tick counter, not wall-clock time
- Timestamps for audit only, not game logic

### BullMQ Deterministic Assumptions

**Assumptions for deterministic processing:**

1. **Idempotency via executionKey**
   ```typescript
   // Each tick job includes unique executionKey
   // Prevents duplicate execution of same tick
   // Stored in SimulationTickExecution table
   ```

2. **Concurrency = 1 (effective)**
   ```typescript
   // Optimistic locking ensures only one worker advances each tick
   // Multiple workers may attempt, but only one succeeds
   // Losers retry next tick
   ```

3. **Retry Safety**
   ```typescript
   // Idempotency ensures retries safe
   // Same tick attempted multiple times → same outcome
   // No side effects outside transaction
   ```

4. **Job Ordering (NOT guaranteed)**
   ```typescript
   // BullMQ does not guarantee FIFO
   // Tick N+1 might be attempted before tick N completes
   // Optimistic locking prevents out-of-order execution
   // Tick counter increments sequentially (enforced by WHERE clause)
   ```

**Documented in queue-runtime.ts JSDoc:**
- See `apps/worker/src/queue-runtime.ts` for full implementation details
- BullMQ provides reliable job scheduling, not ordering
- Determinism enforced by application logic (optimistic locking + idempotency)

---

## Future Improvements

1. **Automated recovery scripts**
   - CLI tools for common recovery scenarios
   - Restore from backup to specific tick
   - Replay transactions from ledger

2. **Enhanced monitoring**
   - Prometheus metrics export
   - Grafana dashboards
   - Alert manager integration

3. **Chaos testing**
   - Automated failure injection
   - Continuous chaos experiments
   - Recovery time measurement

4. **Point-in-time recovery**
   - Transaction log replay
   - Restore to arbitrary tick
   - Time-travel debugging

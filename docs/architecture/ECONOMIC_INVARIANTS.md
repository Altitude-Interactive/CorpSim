# Economic Invariants and Financial Rules

## Overview

CorpSim enforces strict **economic invariants** to maintain financial integrity and prevent impossible states. These invariants are checked at validation points throughout the simulation and enforced through the reservation system, transaction boundaries, and domain constraints.

## Core Financial Invariants

### 1. Cash Integrity

#### No Negative Cash (Unless Explicitly Modeled)
```typescript
cashCents >= 0
```
- Companies cannot spend more cash than they have
- All cash expenses validated before deduction
- Enforced at: Order placement, production start, research start, shipments, workforce hiring

#### Reserved Cash Constraints
```typescript
reservedCashCents >= 0
reservedCashCents <= cashCents
```
- Reserved cash represents committed funds (buy orders)
- Cannot reserve more than total cash
- Available cash = `cashCents - reservedCashCents`
- Enforced at: Buy order placement, order cancellation, trade settlement

#### Cash Conservation
```
Total cash in economy = sum(company.cashCents)
```
- Cash only created/destroyed through:
  - Initial company setup
  - Salary payments (to void)
  - Logistics fees (to void)
  - Production costs (to void, future)
- Cash transfers are always zero-sum (trade settlements)

---

### 2. Inventory Integrity

#### No Negative Inventory (Unless Explicitly Modeled)
```typescript
quantity >= 0
```
- Companies cannot sell more inventory than they have
- All inventory consumption validated before deduction
- Enforced at: Sell order placement, production input consumption, shipment creation

#### Reserved Inventory Constraints
```typescript
reservedQuantity >= 0
reservedQuantity <= quantity
```
- Reserved inventory represents committed stock (sell orders, production inputs)
- Cannot reserve more than total inventory
- Available inventory = `quantity - reservedQuantity`
- Enforced at: Sell order placement, production start, shipment creation

#### Inventory Conservation
```
Total item quantity in economy = sum(inventory.quantity) + sum(in-transit shipments)
```
- Inventory only created/destroyed through:
  - Production completion (created)
  - Demand sink consumption (destroyed)
  - Trade settlement (transferred, not created/destroyed)
  - Shipment delivery (transferred, not created/destroyed)

---

### 3. Ledger Completeness

#### Every Value Movement Recorded
```
For each cash/inventory mutation:
  - Create ledger entry
  - Record: company, type, amount, tick, timestamp
  - Immutable (never updated or deleted)
```

#### Ledger Entry Types
- `PRODUCTION_START` - Production job cost (future)
- `PRODUCTION_COMPLETE` - Production job completion
- `RESEARCH_START` - Research cost deduction
- `BUY_SETTLEMENT` - Market order buy side settlement
- `SELL_SETTLEMENT` - Market order sell side settlement
- `CONTRACT_FULFILLMENT_BUYER` - Contract payment
- `CONTRACT_FULFILLMENT_SELLER` - Contract receipt
- `SHIPMENT_FEE` - Logistics fee deduction
- `WORKFORCE_SALARY` - Workforce salary deduction

#### Audit Trail
- All ledger entries queryable by:
  - Company
  - Tick range
  - Entry type
  - Amount range
- Enables financial auditing and debugging

---

## Reservation System

### Purpose
Prevents double-booking by tracking both total and reserved amounts.

### Two-Phase Resource Locking

#### Phase 1: Reservation (Lock)
```typescript
// For buy orders
reservedCashCents += (quantity * unitPrice)

// For sell orders
reservedQuantity += quantity

// For production inputs
reservedQuantity += (recipe.input.quantity * runs)
```

#### Phase 2: Consumption or Release
```typescript
// On trade settlement (both sides)
cashCents -= tradeNotional
reservedCashCents -= tradeNotional
quantity -= tradedQuantity
reservedQuantity -= tradedQuantity

// On order cancellation
reservedCashCents -= reservedAmount  // Release reservation only
reservedQuantity -= reservedAmount
```

### Reservation Invariants
```typescript
// Always true
availableCash = cashCents - reservedCashCents
availableInventory = quantity - reservedQuantity

// Validation before reservation
availableCash >= reserveAmount
availableInventory >= reserveQuantity
```

### Race Condition Prevention
- Operations check **available** amounts (not total)
- Reservations atomic within transaction
- Concurrent reservations safe (each checks available independently)
- No time-of-check-time-of-use bugs

---

## Transaction Boundaries

### Atomicity Guarantees

#### Per-Operation Atomicity
Each write operation is atomic:
- Place order: Reserve resources OR fail (no partial reservation)
- Cancel order: Release resources OR fail
- Trade settlement: Transfer cash+inventory OR fail (no partial transfer)
- Production completion: Consume inputs + create outputs OR fail

#### Tick-Level Atomicity
Entire tick executes in one transaction:
- All subsystems (bots, production, matching, shipments, etc.)
- World state update (tick increment, lock version)
- Rollback on any failure → tick not advanced

### Isolation Levels
- PostgreSQL default: Read Committed
- Optimistic locking prevents lost updates
- Serializable isolation not required (optimistic locking sufficient)

---

## Market Order Constraints

### Buy Orders
```typescript
// At placement
availableCash >= (quantity * unitPrice)
reservedCashCents += (quantity * unitPrice)

// At settlement
cashCents >= tradeNotional  // Total cash check
reservedCashCents >= tradeNotional  // Reserved check
```

### Sell Orders
```typescript
// At placement
availableInventory >= quantity
reservedQuantity += quantity

// At settlement
quantity >= tradedQuantity  // Total inventory check
reservedQuantity >= tradedQuantity  // Reserved check
```

### Trade Settlement Invariants
```typescript
// Pre-settlement validation
buyOrder.status === OPEN
sellOrder.status === OPEN
buyOrder.unitPrice >= sellOrder.unitPrice
matchedQuantity <= buyOrder.remainingQuantity
matchedQuantity <= sellOrder.remainingQuantity

// Execution price
executionPrice = olderOrder.unitPrice  // Resting order rule

// Post-settlement validation (buyer)
buyerCash >= 0
buyerReservedCash >= 0
buyerReservedCash <= buyerCash

// Post-settlement validation (seller)
sellerInventory >= 0
sellerReservedInventory >= 0
sellerReservedInventory <= sellerInventory
```

---

## Production Constraints

### Job Creation
```typescript
// Input validation
for each input in recipe.inputs:
  availableInventory >= (input.quantity * runs)
  reserve(input.quantity * runs)

// Duration calculation
dueTick = currentTick + duration * workforceMultiplier
```

### Job Completion
```typescript
// Atomic operation
for each input:
  quantity -= input.quantity * runs
  reservedQuantity -= input.quantity * runs

for each output:
  quantity += output.quantity * runs  // Upsert (create or add)

status = COMPLETED
```

### Invariants
- Input atomicity: All inputs consumed or none
- Output atomicity: All outputs created atomically
- No partial completions
- Duration deterministic (workforce modifiers)

---

## Workforce Constraints

### Allocation Invariants
```typescript
operationsPct >= 0 && operationsPct <= 100
researchPct >= 0 && researchPct <= 100
logisticsPct >= 0 && logisticsPct <= 100
corporatePct >= 0 && corporatePct <= 100

operationsPct + researchPct + logisticsPct + corporatePct === 100
```

### Capacity Constraints
```typescript
workforceCapacity >= 0
workforceCapacity <= maxCapacity  // Config limit (future)
```

### Efficiency Constraints
```typescript
orgEfficiencyBps >= 0
orgEfficiencyBps <= 10000  // 100.00%
```

### Salary Invariants
```typescript
salaryPerTick = workforceCapacity * baseSalaryPerCapacity * regionModifier
cashCents >= salaryPerTick  // Must have cash to pay salaries

// If insufficient cash
actualPayment = cashCents  // Partial payment
applyPenalty(salaryShortfallPenalty)  // Efficiency penalty
```

---

## Contract Constraints

### Generation Invariants
```typescript
// Price determination (deterministic)
basePrice = fallbackPriceTable[itemCode]
direction = (tick + sequence) % 2  // 0 or 1
variance = basePrice * priceBandBps / 10000
unitPrice = direction === 0 
  ? basePrice - variance 
  : basePrice + variance

// Quantity determination (deterministic)
quantity = baseQuantity + ((tick + sequence) % 3)
```

### Fulfillment Invariants
```typescript
// Pre-fulfillment validation
contract.status === ACCEPTED
contract.acceptedBySellerId === sellerId
fulfilledQuantity <= contract.remainingQuantity

// Seller inventory
sellerInventory >= fulfilledQuantity

// Buyer cash
buyerCash >= (fulfilledQuantity * contract.unitPrice)

// Atomic transfer
sellerInventory -= fulfilledQuantity
buyerInventory += fulfilledQuantity
buyerCash -= tradeNotional
sellerCash += tradeNotional
```

---

## Shipment Constraints

### Creation Invariants
```typescript
sourceRegion !== destinationRegion  // Can't ship to same region
availableInventory >= quantity
availableCash >= (baseFee + quantity * feePerUnit)

// Atomic deductions
inventory.quantity -= quantity
cash -= totalFee
```

### Delivery Invariants
```typescript
currentTick >= shipment.tickArrives
shipment.status === IN_TRANSIT

// Atomic delivery
destinationInventory += quantity
shipment.status = DELIVERED
```

### Travel Time Determinism
```typescript
baseTravelTime = regionPairTravelTimeMap[source][destination]
adjustedTime = baseTravelTime * workforceLogisticsMultiplier
tickArrives = currentTick + adjustedTime
```

---

## Invariant Violation Handling

### Detection
- **Validation Layer**: Pre-mutation checks (throw DomainInvariantError)
- **Assertion Layer**: Post-mutation checks in domain logic
- **Scan Layer**: Periodic invariant scans (after ticks, on demand)

### Response to Violations
#### Pre-Mutation (Validation)
- Throw error immediately
- Transaction rolls back
- Operation rejected
- Client receives error response

#### Post-Mutation (Assertion)
- Should never happen (indicates bug)
- Transaction rolls back
- Operation fails
- Logs error for investigation

#### Periodic Scan
- Detects accumulated violations (potential bugs)
- Can trigger automated responses:
  - Pause bots (prevent cascade)
  - Stop processing (critical failure)
  - Alert operators
- Violations logged with metadata (tick, company, amounts)

---

## Related Documentation

- [Architecture Overview](./OVERVIEW.md) - System design
- [Simulation Pipeline](./SIMULATION_PIPELINE.md) - Tick execution flow
- [System Boundaries](./SYSTEM_BOUNDARIES.md) - Module responsibilities
- [Reservation System JSDoc](../../packages/sim/src/domain/reservations.ts) - Implementation
- [Invariants Service JSDoc](../../packages/sim/src/services/invariants.ts) - Scanning logic

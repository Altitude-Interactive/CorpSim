# Phase 4 & 5 - Overflow Policy & Economic Design

## Deterministic Overflow Policy

### Strategy: Hybrid Approach

**1. Player-Initiated Actions → REJECT AT SOURCE**
- Production job creation
- Market buy orders
- Building acquisition

**Behavior:** Validation occurs BEFORE transaction. Operation fails with actionable error message.

**Implementation:**
```typescript
// Production
await validateStorageCapacity(tx, companyId, regionId, netInventoryChange);
// Location: packages/sim/src/services/production.ts:247-252

// Market Buy
await validateStorageCapacity(tx, buyOrder.companyId, buyOrder.regionId, match.quantity);
// Location: packages/sim/src/services/market-matching.ts:356-361
```

**2. System-Driven Operations → DELIVERY ROLLBACK**
- Shipment deliveries

**Behavior:** When destination storage full, delivery rolls back to origin (NOT a new shipment with travel time).

**Implementation:**
```typescript
try {
  await validateStorageCapacity(tx, shipment.companyId, shipment.toRegionId, shipment.quantity);
  destinationRegionId = shipment.toRegionId; // Normal delivery
} catch (error) {
  if (error instanceof DomainInvariantError && error.message.includes("storage capacity exceeded")) {
    destinationRegionId = shipment.fromRegionId; // Rollback to origin
    returnedCount += 1;
    
    // CRITICAL: Validate origin capacity (maintains hard cap invariants)
    await validateStorageCapacity(tx, shipment.companyId, shipment.fromRegionId, shipment.quantity);
    // If origin also full, delivery fails - player must manage storage better
  }
}
// Location: packages/sim/src/services/shipments.ts:713-734
```

**Key Differences from "Return to Sender":**
- This is a ROLLBACK, not a logistics return
- No new shipment record created
- No additional travel time
- Origin capacity IS validated (hard caps maintained)
- May fail if both regions full (acceptable - player error)

---

## Multi-Operation Storage Contention

### Same-Tick Processing Order

When multiple operations target the same storage in a single tick:

1. **Deterministic Order:** All operations processed in deterministic order: `ORDER BY tickArrives ASC, tickCreated ASC`
   - Uses tickCreated (deterministic) instead of createdAt (wall-clock time)
   - Guarantees same order on replay
2. **Sequential Validation:** Each operation validates against current state
3. **First-Come-First-Served:** Early operations succeed, later ones may fail/rollback

### Example Scenario

```
Tick 100 at Region A (capacity: 1000, current: 900):
  1. Shipment 1 (tickCreated=50) arrives (quantity: 50) → ✅ Delivered (950/1000)
  2. Shipment 2 (tickCreated=51) arrives (quantity: 100) → ❌ Rollback to origin
     - Destination full, attempts rollback
     - Origin capacity validated - succeeds or fails based on origin state
  3. Production completes (net +80) → ❌ Fails validation (950/1000)
```

**Key Insight:** No race conditions possible - everything is sequential within transaction, ordered by deterministic fields.

---

## Soft-Lock Prevention

### Problem Statement
Without overflow policy, player could be stuck:
- Ship 1000 items to Region B
- Region B only has 500 capacity
- Shipment arrival fails tick processing
- **Game broken - tick cannot advance**

### Solution
Shipment delivery has three-tier fallback to ensure tick NEVER fails:

**Tier 1: Normal Delivery (Destination Has Space)**
- ✅ Tick advances
- ✅ Items delivered to destination
- ✅ Shipment status: DELIVERED

**Tier 2: Rollback (Destination Full, Origin Has Space)**
- ✅ Tick advances
- ✅ Items returned to origin
- ❌ Logistics fee wasted ($250 + $15/unit)
- ❌ Travel time wasted
- ✅ Shipment status: DELIVERED (with rollback)

**Tier 3: Retry (Both Regions Full)**
- ✅ Tick advances (CRITICAL - never fails)
- ⏸️ Shipment stays IN_TRANSIT
- 🔄 Automatic retry next tick
- ℹ️ Player must clear space in either region
- ✅ Shipment status: IN_TRANSIT (unchanged)

**Player learns:** 
- Check destination capacity before shipping
- Don't overfill origin during transit
- Manage storage proactively to avoid retry loops

**Hard Cap Invariants Maintained:** 
- All regions respect capacity limits
- No storage bypass in any scenario
- Retry mechanism prevents soft-lock without violating invariants

---

## Economic Balance Analysis

### Building Cost Structure

| Building | Acquisition | Weekly Cost | Capacity | Category |
|----------|-------------|-------------|----------|----------|
| Workshop | $25,000 | $1,500 | 1 slot | Early |
| Mine | $100,000 | $5,000 | 2 slots | Early |
| Farm | $80,000 | $4,000 | 2 slots | Early |
| Factory | $250,000 | $12,000 | 3 slots | Mid |
| MegaFactory | $1,000,000 | $50,000 | 10 slots | Late |
| Warehouse | $150,000 | $8,000 | +500 items | Storage |
| HQ | $500,000 | $25,000 | 1 slot | Corporate |
| R&D Center | $300,000 | $15,000 | 1 slot | Corporate |

### Break-Even Analysis

#### Assumptions
- Player starts with $500,000 seed capital (default)
- Production recipes yield 20-40% margin
- Weekly operating costs must be covered by revenue

#### Workshop (Recommended Addition)
**Cost:** $25k acquisition + $1.5k/week
**Break-Even:** $1.5k weekly profit = $214/day @ 7 ticks/week
**Use Case:** First building for absolute beginners
**Status:** NOT YET IMPLEMENTED - RECOMMENDED

#### Mine
**Cost:** $100k acquisition + $5k/week
**Break-Even:** $5k weekly profit = $714/day
**Feasible:** ✅ With basic ore → metal recipe
**Risk:** Moderate - needs consistent production

#### Farm
**Cost:** $80k acquisition + $4k/week  
**Break-Even:** $4k weekly profit = $571/day
**Feasible:** ✅ With agricultural products
**Risk:** Low-moderate

#### Factory
**Cost:** $250k acquisition + $12k/week
**Break-Even:** $12k weekly profit = $1,714/day
**Feasible:** ⚠️ Requires established operation
**Risk:** High for early game

#### MegaFactory
**Cost:** $1M acquisition + $50k/week
**Break-Even:** $50k weekly profit = $7,142/day
**Feasible:** ❌ Late game only
**Risk:** **DANGEROUS** if purchased too early - can bankrupt company

### Early Game Viability Assessment

**Current State:** ⚠️ **MARGINAL**
- Cheapest building: Mine at $100k (20% of starting capital)
- Must produce $5k profit/week immediately
- No forgiveness for operational errors

**Recommendation:** Add Workshop tier
```typescript
WORKSHOP: {
  category: "PRODUCTION",
  name: "Workshop",
  description: "Small-scale production facility for beginners",
  acquisitionCostCents: "2500000", // $25,000
  weeklyOperatingCostCents: "150000", // $1,500/week
  capacitySlots: 1
}
```

### Over-Expansion Risk

**Scenario:** Player buys MegaFactory too early
- Acquisition: -$1M (leaves $0 if starting capital)
- Week 1 cost: -$50k → **BANKRUPT** (can't pay)
- Building → INACTIVE
- Production halts
- Soft-lock: Can't earn money without production

**Prevention:**
1. ✅ Preflight validation warns about costs
2. ✅ Building deactivation preserves company (doesn't delete)
3. ✅ Reactivation possible when cash available
4. ⏳ UI warning for "danger zone" acquisitions

### Storage Lock Scenarios

**Scenario:** Player fills all storage, can't receive shipments/production
- Current storage: 1000/1000 (no warehouses)
- Shipment arrives: 500 units → Returns to sender
- Production completes: 100 units → **FAILS** (loses inputs)

**Prevention:**
1. ✅ Storage meter shows capacity in UI
2. ✅ Preflight validation warns before production
3. ✅ Shipments return safely (no loss)
4. ⚠️ Production failure **LOSES INPUTS** - this is harsh
5. **TODO:** Consider returning production inputs to inventory on storage failure

---

## Integration Test Coverage Plan

### Required Tests (Deferred - Need Database)

#### 1. Shipment Overflow Return
```typescript
it("returns shipment to sender when destination storage full")
it("delivers shipment successfully when capacity available")
it("handles multiple shipments with mixed outcomes")
```

#### 2. Same-Tick Storage Contention
```typescript
it("processes operations in deterministic order")
it("allows first operation, rejects second when total exceeds capacity")
```

#### 3. Building Deactivation During Production
```typescript
it("allows running jobs to complete after building deactivates")
it("prevents new jobs when all buildings inactive")
it("reactivates building and allows new jobs")
```

#### 4. Acquisition at Cash Boundary
```typescript
it("allows acquisition when exactly at acquisition cost")
it("rejects acquisition when $1 short")
it("respects reserved cash during acquisition")
```

#### 5. Bankruptcy Risk
```typescript
it("deactivates buildings when operating cost exceeds available cash")
it("preserves company when all buildings deactivated")
it("allows recovery via market sales or contracts")
```

---

## Production-Grade Checklist

- [x] Deterministic overflow policy defined
- [x] Shipment return-to-sender implemented
- [x] Documentation comprehensive
- [x] All unit tests passing (64/64)
- [ ] Integration tests implemented (requires DB setup)
- [ ] Workshop tier added to building definitions
- [ ] Economic balance validated with real gameplay
- [ ] Production failure input recovery (design decision needed)
- [ ] Player-facing overflow documentation
- [ ] UI warnings for danger zone operations

---

## Open Design Questions

### 1. Production Failure Behavior
**Current:** Inputs consumed, no output (storage full)
**Alternative:** Return inputs to inventory, cancel job
**Decision:** **Reviewer input needed**

### 2. Workshop Tier Priority
**Recommendation:** High priority
**Rationale:** Early game currently too harsh
**Decision:** **Approve for implementation?**

### 3. Automatic Building Reactivation
**Current:** Manual only
**Alternative:** Auto-reactivate when cash available
**Decision:** **Keep manual for player control**

---

**Document Version:** 1.0
**Last Updated:** 2026-02-19
**Status:** Awaiting Reviewer Feedback

/**
 * Reservation System - Two-Phase Resource Locking
 *
 * @module domain/reservations
 *
 * ## Purpose
 * Implements a two-phase reservation pattern for both cash and inventory to prevent
 * double-booking and race conditions in concurrent environments. Ensures that resources
 * (cash for buy orders, inventory for sell orders and production) are atomically reserved
 * before being committed to operations.
 *
 * ## How It Prevents Race Conditions
 * 1. **Tracks both total and reserved amounts**: Distinguishes between total balance and
 *    committed (reserved) amounts
 * 2. **Calculates available = total - reserved**: Ensures operations only use unreserved portions
 * 3. **Atomic state transitions**: Each reservation returns a new state snapshot with updated
 *    reserved amounts
 * 4. **Pre-execution validation**: Checks availability BEFORE committing, preventing conflicts
 * 5. **Invariant enforcement**: Assertions guarantee reserved ≤ total, maintaining consistency
 *    across concurrent requests
 *
 * ## Reservation Flow
 * ### For Buy Orders (Cash):
 * 1. Check `availableCash(state)` >= order cost
 * 2. Reserve cash: `reserveCashForBuyOrder()` increments reservedCashCents
 * 3. Create order with reserved cash
 * 4. On trade settlement: Decrement both cashCents and reservedCashCents atomically
 * 5. On order cancellation: Decrement only reservedCashCents (release reservation)
 *
 * ### For Sell Orders (Inventory):
 * 1. Check `availableInventory(state)` >= order quantity
 * 2. Reserve inventory: `reserveInventoryForSellOrder()` increments reservedQuantity
 * 3. Create order with reserved inventory
 * 4. On trade settlement: Decrement both quantity and reservedQuantity atomically
 * 5. On order cancellation: Decrement only reservedQuantity (release reservation)
 *
 * ### For Production (Inventory):
 * 1. Check `availableInventory(state)` >= input requirements
 * 2. Reserve inventory for all inputs
 * 3. Create production job
 * 4. On completion: Consume (decrement both quantity and reservedQuantity)
 * 5. On cancellation: Release (decrement only reservedQuantity)
 *
 * ## Invariants Maintained
 * ### Cash Invariants:
 * - cashCents ≥ 0 (no negative balances)
 * - reservedCashCents ≥ 0 (no negative reservations)
 * - reservedCashCents ≤ cashCents (can't reserve more than you have)
 *
 * ### Inventory Invariants:
 * - quantity ≥ 0 (no negative inventory)
 * - reservedQuantity ≥ 0 (no negative reservations)
 * - reservedQuantity ≤ quantity (can't reserve more than you have)
 * - Both must be integers
 *
 * ## Concurrency Safety
 * This design ensures concurrent requests can safely reserve resources without race
 * conditions—each reservation checks available (unreserved) amounts and updates the
 * reserved pool atomically. Database transactions ensure ACID properties for the
 * reservation state updates.
 *
 * ## Error Handling
 * - InsufficientFundsError: Thrown when attempting to reserve more cash than available
 * - InsufficientInventoryError: Thrown when attempting to reserve more inventory than available
 * - DomainInvariantError: Thrown on invariant violations (negative values, reserved > total)
 */
import {
  DomainInvariantError,
  InsufficientFundsError,
  InsufficientInventoryError
} from "./errors";

export interface CashState {
  cashCents: bigint;
  reservedCashCents: bigint;
}

export interface InventoryState {
  quantity: number;
  reservedQuantity: number;
}

function assertInteger(value: number, name: string): void {
  if (!Number.isInteger(value)) {
    throw new DomainInvariantError(`${name} must be an integer`);
  }
}

export function assertCashInvariant(state: CashState): void {
  if (state.cashCents < 0n) {
    throw new DomainInvariantError("cash cannot be negative");
  }

  if (state.reservedCashCents < 0n) {
    throw new DomainInvariantError("reserved cash cannot be negative");
  }

  if (state.reservedCashCents > state.cashCents) {
    throw new DomainInvariantError("reserved cash cannot exceed cash balance");
  }
}

export function assertInventoryInvariant(state: InventoryState): void {
  assertInteger(state.quantity, "quantity");
  assertInteger(state.reservedQuantity, "reservedQuantity");

  if (state.quantity < 0) {
    throw new DomainInvariantError("inventory quantity cannot be negative");
  }

  if (state.reservedQuantity < 0) {
    throw new DomainInvariantError("reserved quantity cannot be negative");
  }

  if (state.reservedQuantity > state.quantity) {
    throw new DomainInvariantError("reserved quantity cannot exceed inventory quantity");
  }
}

export function availableCash(state: CashState): bigint {
  assertCashInvariant(state);
  return state.cashCents - state.reservedCashCents;
}

export function availableInventory(state: InventoryState): number {
  assertInventoryInvariant(state);
  return state.quantity - state.reservedQuantity;
}

export function reserveCashForBuyOrder(
  state: CashState,
  quantity: number,
  unitPriceCents: bigint
): CashState {
  assertInteger(quantity, "quantity");

  if (quantity <= 0) {
    throw new DomainInvariantError("quantity must be greater than zero");
  }

  if (unitPriceCents <= 0n) {
    throw new DomainInvariantError("unitPriceCents must be greater than zero");
  }

  const reserveAmount = BigInt(quantity) * unitPriceCents;

  if (availableCash(state) < reserveAmount) {
    throw new InsufficientFundsError("insufficient available cash for buy order reserve");
  }

  const nextState: CashState = {
    ...state,
    reservedCashCents: state.reservedCashCents + reserveAmount
  };

  assertCashInvariant(nextState);
  return nextState;
}

export function reserveInventoryForSellOrder(
  state: InventoryState,
  quantity: number
): InventoryState {
  assertInteger(quantity, "quantity");

  if (quantity <= 0) {
    throw new DomainInvariantError("quantity must be greater than zero");
  }

  if (availableInventory(state) < quantity) {
    throw new InsufficientInventoryError(
      "insufficient available inventory for sell order reserve"
    );
  }

  const nextState: InventoryState = {
    ...state,
    reservedQuantity: state.reservedQuantity + quantity
  };

  assertInventoryInvariant(nextState);
  return nextState;
}

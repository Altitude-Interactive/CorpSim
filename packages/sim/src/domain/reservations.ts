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

import { describe, expect, it } from "vitest";
import {
  DomainInvariantError,
  InsufficientFundsError,
  InsufficientInventoryError,
  assertCashInvariant,
  assertInventoryInvariant,
  reserveCashForBuyOrder,
  reserveInventoryForSellOrder
} from "../src";

describe("inventory invariant", () => {
  it("throws when reserved quantity exceeds quantity", () => {
    expect(() =>
      assertInventoryInvariant({
        quantity: 5,
        reservedQuantity: 6
      })
    ).toThrow(DomainInvariantError);
  });

  it("passes for non-negative valid state", () => {
    expect(() =>
      assertInventoryInvariant({
        quantity: 10,
        reservedQuantity: 4
      })
    ).not.toThrow();
  });
});

describe("cash invariant", () => {
  it("throws when reserved cash exceeds balance", () => {
    expect(() =>
      assertCashInvariant({
        cashCents: 1_000n,
        reservedCashCents: 1_001n
      })
    ).toThrow(DomainInvariantError);
  });

  it("passes for valid state", () => {
    expect(() =>
      assertCashInvariant({
        cashCents: 2_500n,
        reservedCashCents: 400n
      })
    ).not.toThrow();
  });
});

describe("order placement reserves", () => {
  it("reserves buy-order cash", () => {
    const reserved = reserveCashForBuyOrder(
      {
        cashCents: 10_000n,
        reservedCashCents: 500n
      },
      3,
      200n
    );

    expect(reserved.reservedCashCents).toBe(1_100n);
  });

  it("rejects buy reserve when funds are insufficient", () => {
    expect(() =>
      reserveCashForBuyOrder(
        {
          cashCents: 1_000n,
          reservedCashCents: 900n
        },
        1,
        200n
      )
    ).toThrow(InsufficientFundsError);
  });

  it("reserves sell-order inventory", () => {
    const reserved = reserveInventoryForSellOrder(
      {
        quantity: 25,
        reservedQuantity: 10
      },
      5
    );

    expect(reserved.reservedQuantity).toBe(15);
  });

  it("rejects sell reserve when inventory is insufficient", () => {
    expect(() =>
      reserveInventoryForSellOrder(
        {
          quantity: 10,
          reservedQuantity: 8
        },
        3
      )
    ).toThrow(InsufficientInventoryError);
  });
});

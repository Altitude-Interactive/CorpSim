import { describe, expect, it } from "vitest";
import {
  DomainInvariantError,
  consumeReservedInventoryForProduction,
  isProductionJobDue,
  reserveInventoryForProduction
} from "../src";

describe("production helpers", () => {
  it("evaluates completion timing from due tick", () => {
    expect(isProductionJobDue(5, 5)).toBe(true);
    expect(isProductionJobDue(6, 5)).toBe(true);
    expect(isProductionJobDue(4, 5)).toBe(false);
  });

  it("reserves and consumes inventory correctly for production jobs", () => {
    const reserved = reserveInventoryForProduction(
      {
        quantity: 20,
        reservedQuantity: 2
      },
      6
    );

    expect(reserved).toEqual({
      quantity: 20,
      reservedQuantity: 8
    });

    const consumed = consumeReservedInventoryForProduction(reserved, 6);
    expect(consumed).toEqual({
      quantity: 14,
      reservedQuantity: 2
    });
  });

  it("rejects reserve/consume operations that violate invariants", () => {
    expect(() =>
      reserveInventoryForProduction(
        {
          quantity: 4,
          reservedQuantity: 3
        },
        2
      )
    ).toThrow(DomainInvariantError);

    expect(() =>
      consumeReservedInventoryForProduction(
        {
          quantity: 4,
          reservedQuantity: 1
        },
        2
      )
    ).toThrow(DomainInvariantError);
  });
});

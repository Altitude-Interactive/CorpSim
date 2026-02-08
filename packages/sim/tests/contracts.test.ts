import { describe, expect, it } from "vitest";
import {
  DomainInvariantError,
  resolveContractUnitPriceCents,
  shouldExpireContract
} from "../src";

describe("contracts helpers", () => {
  it("expires contracts when current tick reaches expiry tick", () => {
    expect(shouldExpireContract(10, 10)).toBe(true);
    expect(shouldExpireContract(11, 10)).toBe(true);
    expect(shouldExpireContract(9, 10)).toBe(false);
  });

  it("uses fallback seeded baseline for pricing when no trades exist", () => {
    const price = resolveContractUnitPriceCents({
      itemCode: "IRON_ORE",
      recentTradeAverageCents: undefined,
      priceBandBps: 500,
      tick: 2,
      sequence: 0
    });

    expect(price).toBe(84n);
  });

  it("rejects invalid expiry inputs", () => {
    expect(() => shouldExpireContract(-1, 5)).toThrow(DomainInvariantError);
    expect(() => shouldExpireContract(1, -5)).toThrow(DomainInvariantError);
  });
});

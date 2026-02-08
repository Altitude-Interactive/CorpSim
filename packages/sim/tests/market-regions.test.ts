import { OrderSide, Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { DomainInvariantError, ForbiddenError } from "../src/domain/errors";
import { planOrderMatchesForItem } from "../src/services/market-matching";
import { placeMarketOrderWithTx } from "../src/services/market-orders";

function order(input: {
  id: string;
  itemId: string;
  regionId: string;
  side: OrderSide;
  unitPriceCents: bigint;
  remainingQuantity: number;
}): {
  id: string;
  itemId: string;
  regionId: string;
  companyId: string;
  side: OrderSide;
  unitPriceCents: bigint;
  remainingQuantity: number;
  tickPlaced: number;
  createdAt: Date;
} {
  return {
    id: input.id,
    itemId: input.itemId,
    regionId: input.regionId,
    companyId: "company-a",
    side: input.side,
    unitPriceCents: input.unitPriceCents,
    remainingQuantity: input.remainingQuantity,
    tickPlaced: 0,
    createdAt: new Date("2026-01-01T00:00:00.000Z")
  };
}

describe("regional market matching", () => {
  it("does not match orders across regions", () => {
    const buys = [
      order({
        id: "buy-core",
        itemId: "item-iron",
        regionId: "region-core",
        side: OrderSide.BUY,
        unitPriceCents: 120n,
        remainingQuantity: 5
      })
    ];
    const sells = [
      order({
        id: "sell-frontier",
        itemId: "item-iron",
        regionId: "region-frontier",
        side: OrderSide.SELL,
        unitPriceCents: 100n,
        remainingQuantity: 5
      })
    ];

    const plans = planOrderMatchesForItem(buys, sells);
    expect(plans).toHaveLength(0);
  });
});

describe("regional order placement", () => {
  it("rejects sell order when company has no inventory row in that region", async () => {
    const tx = {
      worldTickState: {
        findUnique: async () => ({ currentTick: 0 })
      },
      company: {
        findUnique: async () => ({
          id: "company-a",
          cashCents: 1_000n,
          reservedCashCents: 0n,
          regionId: "region-core"
        })
      },
      item: {
        findUnique: async () => ({ id: "item-iron" })
      },
      inventory: {
        findUnique: async () => null
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      placeMarketOrderWithTx(tx, {
        companyId: "company-a",
        itemId: "item-iron",
        regionId: "region-core",
        side: OrderSide.SELL,
        quantity: 3,
        unitPriceCents: 110n
      })
    ).rejects.toBeInstanceOf(DomainInvariantError);
  });

  it("rejects placing an order in a non-home region", async () => {
    const tx = {
      worldTickState: {
        findUnique: async () => ({ currentTick: 0 })
      },
      company: {
        findUnique: async () => ({
          id: "company-a",
          cashCents: 10_000n,
          reservedCashCents: 0n,
          regionId: "region-core"
        })
      },
      item: {
        findUnique: async () => ({ id: "item-iron" })
      }
    } as unknown as Prisma.TransactionClient;

    await expect(
      placeMarketOrderWithTx(tx, {
        companyId: "company-a",
        itemId: "item-iron",
        regionId: "region-frontier",
        side: OrderSide.BUY,
        quantity: 1,
        unitPriceCents: 100n
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

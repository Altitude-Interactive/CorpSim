import { OrderSide } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { MatchableOrder, planOrderMatchesForItem } from "../src/services/market-matching";

function createOrder(input: {
  id: string;
  itemId?: string;
  companyId?: string;
  side: OrderSide;
  unitPriceCents: bigint;
  remainingQuantity: number;
  tickPlaced: number;
  createdAt: string;
}): MatchableOrder {
  return {
    id: input.id,
    itemId: input.itemId ?? "item-1",
    regionId: "region-core",
    companyId: input.companyId ?? "company-1",
    side: input.side,
    unitPriceCents: input.unitPriceCents,
    remainingQuantity: input.remainingQuantity,
    tickPlaced: input.tickPlaced,
    createdAt: new Date(input.createdAt)
  };
}

describe("market matching plan", () => {
  it("matches crossing orders and uses resting order price", () => {
    const buy = createOrder({
      id: "buy-1",
      side: OrderSide.BUY,
      unitPriceCents: 120n,
      remainingQuantity: 5,
      tickPlaced: 2,
      createdAt: "2026-02-08T10:01:00.000Z"
    });
    const sell = createOrder({
      id: "sell-1",
      side: OrderSide.SELL,
      unitPriceCents: 100n,
      remainingQuantity: 5,
      tickPlaced: 1,
      createdAt: "2026-02-08T10:00:00.000Z"
    });

    const matches = planOrderMatchesForItem([buy], [sell]);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      buyOrderId: "buy-1",
      sellOrderId: "sell-1",
      quantity: 5
    });
    expect(matches[0]?.unitPriceCents).toBe(100n);
  });

  it("enforces FIFO within the same buy price level", () => {
    const olderBuy = createOrder({
      id: "buy-old",
      side: OrderSide.BUY,
      unitPriceCents: 120n,
      remainingQuantity: 2,
      tickPlaced: 1,
      createdAt: "2026-02-08T10:00:00.000Z"
    });
    const newerBuy = createOrder({
      id: "buy-new",
      side: OrderSide.BUY,
      unitPriceCents: 120n,
      remainingQuantity: 3,
      tickPlaced: 1,
      createdAt: "2026-02-08T10:01:00.000Z"
    });
    const sell = createOrder({
      id: "sell-1",
      side: OrderSide.SELL,
      unitPriceCents: 110n,
      remainingQuantity: 3,
      tickPlaced: 2,
      createdAt: "2026-02-08T10:02:00.000Z"
    });

    const matches = planOrderMatchesForItem([newerBuy, olderBuy], [sell]);

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      buyOrderId: "buy-old",
      quantity: 2
    });
    expect(matches[1]).toMatchObject({
      buyOrderId: "buy-new",
      quantity: 1
    });
  });

  it("supports partial fills by reducing only matched quantity", () => {
    const buy = createOrder({
      id: "buy-1",
      side: OrderSide.BUY,
      unitPriceCents: 100n,
      remainingQuantity: 10,
      tickPlaced: 1,
      createdAt: "2026-02-08T10:00:00.000Z"
    });
    const sell = createOrder({
      id: "sell-1",
      side: OrderSide.SELL,
      unitPriceCents: 90n,
      remainingQuantity: 4,
      tickPlaced: 2,
      createdAt: "2026-02-08T10:01:00.000Z"
    });

    const matches = planOrderMatchesForItem([buy], [sell]);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      quantity: 4
    });
  });
});

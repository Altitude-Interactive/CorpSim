import { OrderSide } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { planBotActions, resolveBotRuntimeConfig } from "../src/bots/bot-runner";
import { planLiquidityOrders } from "../src/bots/strategies/liquidity-bot";

describe("liquidity bot strategy", () => {
  it("places buy and sell within configured spread and notional cap", () => {
    const orders = planLiquidityOrders(
      {
        availableCashCents: 10_000n,
        items: [
          {
            itemId: "item-iron",
            itemCode: "IRON_ORE",
            referencePriceCents: 100n,
            availableInventory: 12,
            hasOpenBuyOrder: false,
            hasOpenSellOrder: false
          }
        ]
      },
      {
        spreadBps: 500,
        maxNotionalPerTickCents: 2_000n,
        targetQuantityPerSide: 5
      }
    );

    const buy = orders.find((entry) => entry.side === OrderSide.BUY);
    const sell = orders.find((entry) => entry.side === OrderSide.SELL);

    expect(buy).toBeDefined();
    expect(sell).toBeDefined();
    expect(buy?.unitPriceCents).toBe(95n);
    expect(sell?.unitPriceCents).toBe(105n);
    expect(buy?.quantity).toBeGreaterThan(0);
    expect(sell?.quantity).toBeGreaterThan(0);

    const totalNotional = orders.reduce((sum, entry) => {
      return sum + BigInt(entry.quantity) * entry.unitPriceCents;
    }, 0n);
    expect(totalNotional).toBeLessThanOrEqual(2_000n);
  });

  it("respects per-tick notional cap", () => {
    const orders = planLiquidityOrders(
      {
        availableCashCents: 10_000n,
        items: [
          {
            itemId: "item-iron",
            itemCode: "IRON_ORE",
            referencePriceCents: 100n,
            availableInventory: 20,
            hasOpenBuyOrder: false,
            hasOpenSellOrder: false
          }
        ]
      },
      {
        spreadBps: 500,
        maxNotionalPerTickCents: 300n,
        targetQuantityPerSide: 10
      }
    );

    const totalNotional = orders.reduce((sum, entry) => {
      return sum + BigInt(entry.quantity) * entry.unitPriceCents;
    }, 0n);
    expect(totalNotional).toBeLessThanOrEqual(300n);
  });
});

describe("bot runner planning", () => {
  it("is deterministic for the same tick-state snapshot", () => {
    const config = resolveBotRuntimeConfig({
      enabled: true,
      botCount: 3,
      itemCodes: ["IRON_ORE"],
      spreadBps: 500,
      maxNotionalPerTickCents: 10_000n
    });

    const snapshot = [
      {
        companyId: "company-b",
        companyCode: "BOT_TRADER_B",
        strategy: "LIQUIDITY" as const,
        availableCashCents: 50_000n,
        items: [
          {
            itemId: "item-iron",
            itemCode: "IRON_ORE",
            referencePriceCents: 100n,
            availableInventory: 10,
            hasOpenBuyOrder: false,
            hasOpenSellOrder: false
          }
        ]
      },
      {
        companyId: "company-a",
        companyCode: "BOT_MINER_A",
        strategy: "PRODUCER" as const,
        availableCashCents: 80_000n,
        items: []
      }
    ];

    const firstPlan = planBotActions(snapshot, config);
    const secondPlan = planBotActions(snapshot, config);

    expect(firstPlan).toStrictEqual(secondPlan);
    expect(firstPlan.producerCompanyIds).toStrictEqual(["company-a"]);
    expect(firstPlan.orderPlacements.length).toBeGreaterThan(0);
  });
});

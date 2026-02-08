import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { computeTickCandlesFromTrades, upsertMarketCandlesForTick } from "../src";

describe("market candle computation", () => {
  it("computes deterministic OHLCV and VWAP from trades", () => {
    const candles = computeTickCandlesFromTrades(5, [
      {
        id: "trade-2",
        itemId: "item-a",
        regionId: "region-core",
        unitPriceCents: 105n,
        quantity: 2,
        createdAt: new Date("2026-02-08T20:00:01.000Z")
      },
      {
        id: "trade-1",
        itemId: "item-a",
        regionId: "region-core",
        unitPriceCents: 100n,
        quantity: 3,
        createdAt: new Date("2026-02-08T20:00:00.000Z")
      },
      {
        id: "trade-3",
        itemId: "item-a",
        regionId: "region-core",
        unitPriceCents: 90n,
        quantity: 5,
        createdAt: new Date("2026-02-08T20:00:02.000Z")
      }
    ]);

    expect(candles).toEqual([
      {
        itemId: "item-a",
        regionId: "region-core",
        tick: 5,
        openCents: 100n,
        highCents: 105n,
        lowCents: 90n,
        closeCents: 90n,
        volumeQty: 10,
        tradeCount: 3,
        vwapCents: 96n
      }
    ]);
  });

  it("upserts the same candle payload on repeated runs (idempotent)", async () => {
    const upsert = vi.fn().mockResolvedValue(null);
    const tradeFindMany = vi.fn().mockResolvedValue([
      {
        id: "trade-1",
        itemId: "item-a",
        regionId: "region-core",
        unitPriceCents: 100n,
        quantity: 1,
        createdAt: new Date("2026-02-08T20:00:00.000Z")
      }
    ]);

    const tx = {
      trade: {
        findMany: tradeFindMany
      },
      itemTickCandle: {
        upsert
      }
    } as unknown as Prisma.TransactionClient;

    await upsertMarketCandlesForTick(tx, 7);
    await upsertMarketCandlesForTick(tx, 7);

    expect(tradeFindMany).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(1, {
      where: {
        itemId_regionId_tick: {
          itemId: "item-a",
          regionId: "region-core",
          tick: 7
        }
      },
      create: {
        itemId: "item-a",
        regionId: "region-core",
        tick: 7,
        openCents: 100n,
        highCents: 100n,
        lowCents: 100n,
        closeCents: 100n,
        volumeQty: 1,
        tradeCount: 1,
        vwapCents: 100n
      },
      update: {
        openCents: 100n,
        highCents: 100n,
        lowCents: 100n,
        closeCents: 100n,
        volumeQty: 1,
        tradeCount: 1,
        vwapCents: 100n
      }
    });
    expect(upsert).toHaveBeenNthCalledWith(2, {
      where: {
        itemId_regionId_tick: {
          itemId: "item-a",
          regionId: "region-core",
          tick: 7
        }
      },
      create: {
        itemId: "item-a",
        regionId: "region-core",
        tick: 7,
        openCents: 100n,
        highCents: 100n,
        lowCents: 100n,
        closeCents: 100n,
        volumeQty: 1,
        tradeCount: 1,
        vwapCents: 100n
      },
      update: {
        openCents: 100n,
        highCents: 100n,
        lowCents: 100n,
        closeCents: 100n,
        volumeQty: 1,
        tradeCount: 1,
        vwapCents: 100n
      }
    });
  });
});

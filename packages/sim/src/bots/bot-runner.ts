import { OrderSide, OrderStatus, Prisma } from "@prisma/client";
import { resolveIconItemFallbackPriceCents } from "@corpsim/shared";
import { DomainInvariantError } from "../domain/errors";
import { availableCash } from "../domain/reservations";
import { placeMarketOrderWithTx } from "../services/market-orders";
import { runProducerBot } from "./strategies/producer-bot";
import {
  LiquidityBotConfig,
  LiquidityBotState,
  planLiquidityOrders
} from "./strategies/liquidity-bot";

export interface BotRuntimeConfig {
  enabled: boolean;
  botCount: number;
  itemCodes: string[];
  spreadBps: number;
  maxNotionalPerTickCents: bigint;
  targetQuantityPerSide: number;
  producerMaxJobsPerTick: number;
  producerCadenceTicks: number;
  producerMinProfitBps: number;
}

export interface BotCompanySnapshot {
  companyId: string;
  companyCode: string;
  strategy: "LIQUIDITY" | "PRODUCER";
  availableCashCents: bigint;
  items: LiquidityBotState["items"];
}

export interface PlannedBotOrderPlacement {
  companyId: string;
  itemId: string;
  side: OrderSide;
  quantity: number;
  unitPriceCents: bigint;
}

export interface BotExecutionPlan {
  orderPlacements: PlannedBotOrderPlacement[];
  producerCompanyIds: string[];
}

export interface RunBotsResult {
  placedOrders: number;
  startedProductionJobs: number;
}

const DEFAULT_REFERENCE_PRICES = new Map<string, bigint>([
  ["IRON_ORE", 80n],
  ["COAL", 55n],
  ["COPPER_ORE", 95n],
  ["WATER", 15n],
  ["FERTILIZER", 35n],
  ["BIO_SUBSTRATE", 40n],
  ["IRON_INGOT", 200n],
  ["COPPER_INGOT", 245n],
  ["HAND_TOOLS", 350n],
  ["STEEL_INGOT", 430n],
  ["STEEL_BEAM", 940n],
  ["FASTENERS", 150n],
  ["MACHINE_PARTS", 1_250n],
  ["TOOL_KIT", 2_100n],
  ["POWER_UNIT", 2_550n],
  ["CONVEYOR_MODULE", 4_250n],
  ["INDUSTRIAL_PRESS", 11_500n],
  ["SYNTHETIC_CONDUIT", 520n],
  ["BIOCELL_CANISTER", 780n],
  ["SERVO_DRIVE", 1_450n],
  ["OPTIC_MODULE", 1_820n],
  ["NEURAL_INTERFACE", 3_600n],
  ["SPINAL_LINK", 7_600n],
  ["OCULAR_IMPLANT", 8_200n],
  ["CYBER_ARMATURE", 9_400n],
  ["CYBERNETIC_SUITE", 24_000n]
]);

export const DEFAULT_BOT_RUNTIME_CONFIG: BotRuntimeConfig = {
  enabled: false,
  botCount: 25,
  itemCodes: [],
  spreadBps: 500,
  maxNotionalPerTickCents: 50_000n,
  targetQuantityPerSide: 5,
  producerMaxJobsPerTick: 1,
  producerCadenceTicks: 3,
  producerMinProfitBps: 0
};

function normalizeItemCodes(itemCodes: string[]): string[] {
  const normalized = itemCodes.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}

export function resolveBotRuntimeConfig(
  overrides: Partial<BotRuntimeConfig> = {}
): BotRuntimeConfig {
  const itemCodes = normalizeItemCodes(overrides.itemCodes ?? DEFAULT_BOT_RUNTIME_CONFIG.itemCodes);

  return {
    enabled: overrides.enabled ?? DEFAULT_BOT_RUNTIME_CONFIG.enabled,
    botCount: overrides.botCount ?? DEFAULT_BOT_RUNTIME_CONFIG.botCount,
    itemCodes,
    spreadBps: overrides.spreadBps ?? DEFAULT_BOT_RUNTIME_CONFIG.spreadBps,
    maxNotionalPerTickCents:
      overrides.maxNotionalPerTickCents ?? DEFAULT_BOT_RUNTIME_CONFIG.maxNotionalPerTickCents,
    targetQuantityPerSide:
      overrides.targetQuantityPerSide ?? DEFAULT_BOT_RUNTIME_CONFIG.targetQuantityPerSide,
    producerMaxJobsPerTick:
      overrides.producerMaxJobsPerTick ?? DEFAULT_BOT_RUNTIME_CONFIG.producerMaxJobsPerTick,
    producerCadenceTicks:
      overrides.producerCadenceTicks ?? DEFAULT_BOT_RUNTIME_CONFIG.producerCadenceTicks,
    producerMinProfitBps:
      overrides.producerMinProfitBps ?? DEFAULT_BOT_RUNTIME_CONFIG.producerMinProfitBps
  };
}

function toLiquidityConfig(config: BotRuntimeConfig): LiquidityBotConfig {
  return {
    spreadBps: config.spreadBps,
    maxNotionalPerTickCents: config.maxNotionalPerTickCents,
    targetQuantityPerSide: config.targetQuantityPerSide
  };
}

export function planBotActions(
  companies: BotCompanySnapshot[],
  config: BotRuntimeConfig
): BotExecutionPlan {
  const liquidityConfig = toLiquidityConfig(config);
  const sortedCompanies = [...companies].sort((left, right) =>
    left.companyCode.localeCompare(right.companyCode)
  );

  const orderPlacements: PlannedBotOrderPlacement[] = [];
  const producerCompanyIds: string[] = [];

  for (const company of sortedCompanies) {
    if (company.strategy === "PRODUCER") {
      producerCompanyIds.push(company.companyId);
      continue;
    }

    const planned = planLiquidityOrders(
      {
        availableCashCents: company.availableCashCents,
        items: company.items
      },
      liquidityConfig
    );

    for (const order of planned) {
      orderPlacements.push({
        companyId: company.companyId,
        itemId: order.itemId,
        side: order.side,
        quantity: order.quantity,
        unitPriceCents: order.unitPriceCents
      });
    }
  }

  return {
    orderPlacements,
    producerCompanyIds
  };
}

function resolveReferencePrice(
  itemCode: string,
  regionId: string,
  itemId: string,
  bestBuyPriceByRegionItem: Map<string, bigint>,
  bestSellPriceByRegionItem: Map<string, bigint>,
  latestTradeByRegionItem: Map<string, bigint>
): bigint {
  const key = `${regionId}:${itemId}`;
  const lastTrade = latestTradeByRegionItem.get(key);
  if (lastTrade !== undefined) {
    return lastTrade;
  }

  const bestBuy = bestBuyPriceByRegionItem.get(key);
  const bestSell = bestSellPriceByRegionItem.get(key);

  if (bestBuy !== undefined && bestSell !== undefined) {
    return (bestBuy + bestSell) / 2n;
  }
  if (bestBuy !== undefined) {
    return bestBuy;
  }
  if (bestSell !== undefined) {
    return bestSell;
  }

  return (
    DEFAULT_REFERENCE_PRICES.get(itemCode) ??
    resolveIconItemFallbackPriceCents(itemCode) ??
    100n
  );
}

function inferStrategy(companyCode: string): "LIQUIDITY" | "PRODUCER" {
  return companyCode.includes("TRADER") ? "LIQUIDITY" : "PRODUCER";
}

export async function runBotsForTick(
  tx: Prisma.TransactionClient,
  tick: number,
  overrides: Partial<BotRuntimeConfig> = {}
): Promise<RunBotsResult> {
  const config = resolveBotRuntimeConfig(overrides);

  if (!config.enabled) {
    return { placedOrders: 0, startedProductionJobs: 0 };
  }

  if (!Number.isInteger(tick) || tick < 0) {
    throw new DomainInvariantError("tick must be a non-negative integer");
  }

  if (config.botCount <= 0) {
    return { placedOrders: 0, startedProductionJobs: 0 };
  }

  const companies = await tx.company.findMany({
    where: { isPlayer: false },
    orderBy: { code: "asc" },
    take: config.botCount,
    select: {
      id: true,
      code: true,
      regionId: true,
      cashCents: true,
      reservedCashCents: true
    }
  });

  if (companies.length === 0) {
    return { placedOrders: 0, startedProductionJobs: 0 };
  }

  const items = await tx.item.findMany({
    where:
      config.itemCodes.length > 0
        ? { code: { in: config.itemCodes } }
        : undefined,
    orderBy: { code: "asc" },
    select: { id: true, code: true }
  });

  if (items.length === 0) {
    return { placedOrders: 0, startedProductionJobs: 0 };
  }

  const companyIds = companies.map((entry) => entry.id);
  const itemIds = items.map((entry) => entry.id);

  const [inventories, openOrders, bookOrders, latestTrades] = await Promise.all([
    tx.inventory.findMany({
      where: {
        companyId: { in: companyIds },
        itemId: { in: itemIds }
      },
      select: {
        companyId: true,
        itemId: true,
        regionId: true,
        quantity: true,
        reservedQuantity: true
      }
    }),
    tx.marketOrder.findMany({
      where: {
        companyId: { in: companyIds },
        itemId: { in: itemIds },
        status: OrderStatus.OPEN
      },
      select: {
        companyId: true,
        regionId: true,
        itemId: true,
        side: true
      }
    }),
    tx.marketOrder.findMany({
      where: {
        itemId: { in: itemIds },
        status: OrderStatus.OPEN
      },
      select: {
        regionId: true,
        itemId: true,
        side: true,
        unitPriceCents: true
      }
    }),
    tx.trade.findMany({
      where: { itemId: { in: itemIds } },
      orderBy: [{ tick: "desc" }, { createdAt: "desc" }],
      select: {
        regionId: true,
        itemId: true,
        unitPriceCents: true
      }
    })
  ]);

  const inventoryByKey = new Map(
    inventories.map(
      (entry) => [`${entry.companyId}:${entry.itemId}:${entry.regionId}`, entry] as const
    )
  );
  const openOrderKeySet = new Set(
    openOrders.map((entry) => `${entry.companyId}:${entry.regionId}:${entry.itemId}:${entry.side}`)
  );

  const bestBuyPriceByRegionItem = new Map<string, bigint>();
  const bestSellPriceByRegionItem = new Map<string, bigint>();

  for (const order of bookOrders) {
    const key = `${order.regionId}:${order.itemId}`;
    if (order.side === OrderSide.BUY) {
      const current = bestBuyPriceByRegionItem.get(key);
      if (current === undefined || order.unitPriceCents > current) {
        bestBuyPriceByRegionItem.set(key, order.unitPriceCents);
      }
      continue;
    }

    const current = bestSellPriceByRegionItem.get(key);
    if (current === undefined || order.unitPriceCents < current) {
      bestSellPriceByRegionItem.set(key, order.unitPriceCents);
    }
  }

  const latestTradeByRegionItem = new Map<string, bigint>();
  for (const trade of latestTrades) {
    const key = `${trade.regionId}:${trade.itemId}`;
    if (!latestTradeByRegionItem.has(key)) {
      latestTradeByRegionItem.set(key, trade.unitPriceCents);
    }
  }

  const referencePriceByCompanyId = new Map<string, Map<string, bigint>>();

  const companySnapshots: BotCompanySnapshot[] = companies.map((company) => {
    const referencePriceByItemId = new Map<string, bigint>(
      items.map((item) => [
        item.id,
        resolveReferencePrice(
          item.code,
          company.regionId,
          item.id,
          bestBuyPriceByRegionItem,
          bestSellPriceByRegionItem,
          latestTradeByRegionItem
        )
      ])
    );
    referencePriceByCompanyId.set(company.id, referencePriceByItemId);

    const itemsForCompany = items.map((item) => {
      const companyInventory = inventoryByKey.get(
        `${company.id}:${item.id}:${company.regionId}`
      );
      const availableInventory = Math.max(
        0,
        (companyInventory?.quantity ?? 0) - (companyInventory?.reservedQuantity ?? 0)
      );

      return {
        itemId: item.id,
        itemCode: item.code,
        referencePriceCents: referencePriceByItemId.get(item.id) ?? 100n,
        availableInventory,
        hasOpenBuyOrder: openOrderKeySet.has(
          `${company.id}:${company.regionId}:${item.id}:${OrderSide.BUY}`
        ),
        hasOpenSellOrder: openOrderKeySet.has(
          `${company.id}:${company.regionId}:${item.id}:${OrderSide.SELL}`
        )
      };
    });

    return {
      companyId: company.id,
      companyCode: company.code,
      strategy: inferStrategy(company.code),
      availableCashCents: availableCash({
        cashCents: company.cashCents,
        reservedCashCents: company.reservedCashCents
      }),
      items: itemsForCompany
    };
  });

  const plan = planBotActions(companySnapshots, config);

  let placedOrders = 0;
  for (const order of plan.orderPlacements) {
    await placeMarketOrderWithTx(tx, {
      companyId: order.companyId,
      itemId: order.itemId,
      side: order.side,
      quantity: order.quantity,
      unitPriceCents: order.unitPriceCents,
      tick
    });
    placedOrders += 1;
  }

  let startedProductionJobs = 0;
  for (const companyId of plan.producerCompanyIds) {
    startedProductionJobs += await runProducerBot(tx, {
      companyId,
      tick,
      maxJobsPerTick: config.producerMaxJobsPerTick,
      cadenceTicks: config.producerCadenceTicks,
      minProfitBps: config.producerMinProfitBps,
      referencePriceByItemId: referencePriceByCompanyId.get(companyId) ?? new Map()
    });
  }

  return {
    placedOrders,
    startedProductionJobs
  };
}

import {
  LedgerEntryType,
  OrderStatus,
  OrderSide,
  PrismaClient,
  ProductionJobStatus
} from "@prisma/client";
import { DomainInvariantError, NotFoundError } from "../domain/errors";
import { scanSimulationInvariants } from "./invariants";

export interface MarketOrderFilters {
  itemId?: string;
  regionId?: string;
  side?: OrderSide;
  companyId?: string;
  limit?: number;
}

export interface MarketTradeFilters {
  itemId?: string;
  regionId?: string;
  companyId?: string;
  limit?: number;
}

export interface MarketCandleFilters {
  itemId: string;
  regionId: string;
  fromTick?: number;
  toTick?: number;
  limit?: number;
}

export interface MarketAnalyticsSummaryInput {
  itemId: string;
  regionId: string;
  windowTicks?: number;
}

export interface MarketAnalyticsSummaryOutput {
  itemId: string;
  regionId: string;
  fromTick: number;
  toTick: number;
  candleCount: number;
  lastPriceCents: bigint | null;
  changePctBps: number | null;
  highCents: bigint | null;
  lowCents: bigint | null;
  avgVolumeQty: number;
  totalVolumeQty: number;
  vwapCents: bigint | null;
}

export interface ProductionJobFilters {
  companyId?: string;
  status?: ProductionJobStatus;
  limit?: number;
}

export interface RecipeFilters {
  companyId?: string;
}

export interface CompanyLedgerFilters {
  companyId: string;
  fromTick?: number;
  toTick?: number;
  entryType?: LedgerEntryType;
  referenceType?: string;
  referenceId?: string;
  limit?: number;
  cursor?: string;
}

export interface CompanyLedgerCursor {
  createdAt: string;
  id: string;
}

export interface FinanceSummaryInput {
  companyId: string;
  windowTicks?: number;
}

export interface FinanceSummaryOutput {
  startingCashCents: bigint;
  endingCashCents: bigint;
  totalDeltaCashCents: bigint;
  totalDeltaReservedCashCents: bigint;
  breakdownByEntryType: Array<{
    entryType: LedgerEntryType;
    deltaCashCents: bigint;
    deltaReservedCashCents: bigint;
    count: number;
  }>;
  tradesCount: number;
  ordersPlacedCount: number;
  ordersCancelledCount: number;
  productionsCompletedCount: number;
}

function encodeLedgerCursor(cursor: CompanyLedgerCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeLedgerCursor(cursor: string): CompanyLedgerCursor {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as unknown;

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { createdAt?: unknown }).createdAt !== "string" ||
      typeof (parsed as { id?: unknown }).id !== "string"
    ) {
      throw new Error("invalid cursor payload");
    }

    const createdAt = (parsed as { createdAt: string }).createdAt;
    const timestamp = Date.parse(createdAt);
    if (!Number.isFinite(timestamp)) {
      throw new Error("invalid cursor timestamp");
    }

    return {
      createdAt,
      id: (parsed as { id: string }).id
    };
  } catch {
    throw new DomainInvariantError("cursor is invalid");
  }
}

export interface SimulationHealthSnapshot {
  currentTick: number;
  lockVersion: number;
  lastAdvancedAt: Date | null;
  ordersOpenCount: number;
  ordersTotalCount: number;
  tradesLast100Count: number;
  companiesCount: number;
  botsCount: number;
  sumCashCents: bigint;
  sumReservedCashCents: bigint;
  invariants: {
    hasViolations: boolean;
    truncated: boolean;
    issues: Array<{
      code: string;
      entityType: "company" | "inventory";
      companyId: string;
      itemId?: string;
      message: string;
    }>;
  };
}

export async function listCompanies(prisma: PrismaClient) {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      isPlayer: true,
      cashCents: true,
      region: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  });

  return companies.map((company) => ({
    id: company.id,
    code: company.code,
    name: company.name,
    isBot: !company.isPlayer,
    cashCents: company.cashCents,
    regionId: company.region.id,
    regionCode: company.region.code,
    regionName: company.region.name
  }));
}

export async function getCompanyById(prisma: PrismaClient, companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      code: true,
      name: true,
      isPlayer: true,
      cashCents: true,
      reservedCashCents: true,
      region: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      createdAt: true,
      updatedAt: true
    }
  });

  if (!company) {
    throw new NotFoundError(`company ${companyId} not found`);
  }

  return {
    id: company.id,
    code: company.code,
    name: company.name,
    cashCents: company.cashCents,
    reservedCashCents: company.reservedCashCents,
    regionId: company.region.id,
    regionCode: company.region.code,
    regionName: company.region.name,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
    isBot: !company.isPlayer
  };
}

export async function listCompanyInventory(
  prisma: PrismaClient,
  companyId: string,
  regionId?: string
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, regionId: true }
  });

  if (!company) {
    throw new NotFoundError(`company ${companyId} not found`);
  }
  const effectiveRegionId = regionId ?? company.regionId;

  return prisma.inventory.findMany({
    where: { companyId, regionId: effectiveRegionId },
    orderBy: { item: { code: "asc" } },
    select: {
      itemId: true,
      regionId: true,
      quantity: true,
      reservedQuantity: true,
      item: {
        select: {
          code: true,
          name: true
        }
      }
    }
  });
}

export async function listMarketOrders(
  prisma: PrismaClient,
  filters: MarketOrderFilters = {}
) {
  const limit = filters.limit ?? 100;

  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new DomainInvariantError("limit must be an integer between 1 and 500");
  }

  return prisma.marketOrder.findMany({
    where: {
      itemId: filters.itemId,
      regionId: filters.regionId,
      side: filters.side,
      companyId: filters.companyId
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      companyId: true,
      itemId: true,
      regionId: true,
      side: true,
      status: true,
      quantity: true,
      remainingQuantity: true,
      unitPriceCents: true,
      reservedCashCents: true,
      reservedQuantity: true,
      tickPlaced: true,
      tickClosed: true,
      createdAt: true,
      updatedAt: true,
      closedAt: true
    }
  });
}

export async function listMarketTrades(
  prisma: PrismaClient,
  filters: MarketTradeFilters = {}
) {
  const limit = filters.limit ?? 50;

  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new DomainInvariantError("limit must be an integer between 1 and 200");
  }

  return prisma.trade.findMany({
    where: {
      itemId: filters.itemId,
      regionId: filters.regionId,
      ...(filters.companyId
        ? {
            OR: [
              { buyerCompanyId: filters.companyId },
              { sellerCompanyId: filters.companyId }
            ]
          }
        : {})
    },
    orderBy: [{ tick: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      tick: true,
      itemId: true,
      regionId: true,
      buyerCompanyId: true,
      sellerCompanyId: true,
      unitPriceCents: true,
      quantity: true,
      createdAt: true
    }
  });
}

export async function listMarketCandles(
  prisma: PrismaClient,
  filters: MarketCandleFilters
) {
  if (!filters.itemId) {
    throw new DomainInvariantError("itemId is required");
  }
  if (!filters.regionId) {
    throw new DomainInvariantError("regionId is required");
  }

  const limit = filters.limit ?? 200;
  if (!Number.isInteger(limit) || limit < 1 || limit > 2000) {
    throw new DomainInvariantError("limit must be an integer between 1 and 2000");
  }

  if (filters.fromTick !== undefined && (!Number.isInteger(filters.fromTick) || filters.fromTick < 0)) {
    throw new DomainInvariantError("fromTick must be a non-negative integer");
  }
  if (filters.toTick !== undefined && (!Number.isInteger(filters.toTick) || filters.toTick < 0)) {
    throw new DomainInvariantError("toTick must be a non-negative integer");
  }
  if (
    filters.fromTick !== undefined &&
    filters.toTick !== undefined &&
    filters.fromTick > filters.toTick
  ) {
    throw new DomainInvariantError("fromTick cannot be greater than toTick");
  }

  const [itemExists, regionExists] = await Promise.all([
    prisma.item.findUnique({
      where: { id: filters.itemId },
      select: { id: true }
    }),
    prisma.region.findUnique({
      where: { id: filters.regionId },
      select: { id: true }
    })
  ]);

  if (!itemExists) {
    throw new NotFoundError(`item ${filters.itemId} not found`);
  }
  if (!regionExists) {
    throw new NotFoundError(`region ${filters.regionId} not found`);
  }

  const rows = await prisma.itemTickCandle.findMany({
    where: {
      itemId: filters.itemId,
      regionId: filters.regionId,
      tick: {
        gte: filters.fromTick,
        lte: filters.toTick
      }
    },
    orderBy: [{ tick: "desc" }],
    take: limit,
    select: {
      id: true,
      itemId: true,
      regionId: true,
      tick: true,
      openCents: true,
      highCents: true,
      lowCents: true,
      closeCents: true,
      volumeQty: true,
      tradeCount: true,
      vwapCents: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return rows.reverse();
}

export async function getMarketAnalyticsSummary(
  prisma: PrismaClient,
  input: MarketAnalyticsSummaryInput
): Promise<MarketAnalyticsSummaryOutput> {
  if (!input.itemId) {
    throw new DomainInvariantError("itemId is required");
  }
  if (!input.regionId) {
    throw new DomainInvariantError("regionId is required");
  }

  const windowTicks = input.windowTicks ?? 200;
  if (!Number.isInteger(windowTicks) || windowTicks < 1 || windowTicks > 10_000) {
    throw new DomainInvariantError("windowTicks must be an integer between 1 and 10000");
  }

  const [item, region, world] = await Promise.all([
    prisma.item.findUnique({
      where: { id: input.itemId },
      select: { id: true }
    }),
    prisma.region.findUnique({
      where: { id: input.regionId },
      select: { id: true }
    }),
    prisma.worldTickState.findUnique({
      where: { id: 1 },
      select: { currentTick: true }
    })
  ]);

  if (!item) {
    throw new NotFoundError(`item ${input.itemId} not found`);
  }
  if (!region) {
    throw new NotFoundError(`region ${input.regionId} not found`);
  }

  const toTick = world?.currentTick ?? 0;
  const fromTick = Math.max(0, toTick - windowTicks + 1);

  const candles = await prisma.itemTickCandle.findMany({
    where: {
      itemId: input.itemId,
      regionId: input.regionId,
      tick: {
        gte: fromTick,
        lte: toTick
      }
    },
    orderBy: [{ tick: "asc" }],
    select: {
      tick: true,
      openCents: true,
      highCents: true,
      lowCents: true,
      closeCents: true,
      volumeQty: true,
      vwapCents: true
    }
  });

  if (candles.length === 0) {
    return {
      itemId: input.itemId,
      regionId: input.regionId,
      fromTick,
      toTick,
      candleCount: 0,
      lastPriceCents: null,
      changePctBps: null,
      highCents: null,
      lowCents: null,
      avgVolumeQty: 0,
      totalVolumeQty: 0,
      vwapCents: null
    };
  }

  const first = candles[0];
  const last = candles[candles.length - 1];

  if (!first || !last) {
    throw new DomainInvariantError("candle sequence unexpectedly empty");
  }

  let high = first.highCents;
  let low = first.lowCents;
  let totalVolumeQty = 0;
  let weightedNotional = 0n;

  for (const candle of candles) {
    if (candle.highCents > high) {
      high = candle.highCents;
    }
    if (candle.lowCents < low) {
      low = candle.lowCents;
    }

    totalVolumeQty += candle.volumeQty;
    if (candle.vwapCents !== null && candle.volumeQty > 0) {
      weightedNotional += candle.vwapCents * BigInt(candle.volumeQty);
    }
  }

  const avgVolumeQty = Math.round(totalVolumeQty / candles.length);
  const vwapCents =
    totalVolumeQty > 0
      ? (weightedNotional + BigInt(Math.floor(totalVolumeQty / 2))) / BigInt(totalVolumeQty)
      : null;

  let changePctBps: number | null = null;
  if (first.openCents > 0n) {
    const numerator = (last.closeCents - first.openCents) * 10_000n;
    const rounded =
      numerator >= 0n
        ? (numerator + first.openCents / 2n) / first.openCents
        : (numerator - first.openCents / 2n) / first.openCents;
    changePctBps = Number(rounded);
  }

  return {
    itemId: input.itemId,
    regionId: input.regionId,
    fromTick,
    toTick,
    candleCount: candles.length,
    lastPriceCents: last.closeCents,
    changePctBps,
    highCents: high,
    lowCents: low,
    avgVolumeQty,
    totalVolumeQty,
    vwapCents
  };
}

export async function listItems(prisma: PrismaClient) {
  return prisma.item.findMany({
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true
    }
  });
}

export async function listRecipes(prisma: PrismaClient, filters: RecipeFilters = {}) {
  return prisma.recipe.findMany({
    where: filters.companyId
      ? {
          companyRecipes: {
            some: {
              companyId: filters.companyId,
              isUnlocked: true
            }
          }
        }
      : undefined,
    orderBy: [{ code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      durationTicks: true,
      outputQuantity: true,
      outputItem: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      inputs: {
        orderBy: { item: { code: "asc" } },
        select: {
          itemId: true,
          quantity: true,
          item: {
            select: {
              id: true,
              code: true,
              name: true
            }
          }
        }
      }
    }
  });
}

export async function listProductionJobs(
  prisma: PrismaClient,
  filters: ProductionJobFilters = {}
) {
  const limit = filters.limit ?? 100;

  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new DomainInvariantError("limit must be an integer between 1 and 500");
  }

  return prisma.productionJob.findMany({
    where: {
      companyId: filters.companyId,
      status: filters.status
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    include: {
      recipe: {
        select: {
          id: true,
          code: true,
          name: true,
          durationTicks: true,
          outputQuantity: true,
          outputItem: {
            select: {
              id: true,
              code: true,
              name: true
            }
          },
          inputs: {
            orderBy: { item: { code: "asc" } },
            select: {
              itemId: true,
              quantity: true,
              item: {
                select: {
                  id: true,
                  code: true,
                  name: true
                }
              }
            }
          }
        }
      }
    }
  });
}

export async function getCompanyLedger(
  prisma: PrismaClient,
  filters: CompanyLedgerFilters
) {
  if (!filters.companyId) {
    throw new DomainInvariantError("companyId is required");
  }

  const limit = filters.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new DomainInvariantError("limit must be an integer between 1 and 500");
  }

  if (filters.fromTick !== undefined && (!Number.isInteger(filters.fromTick) || filters.fromTick < 0)) {
    throw new DomainInvariantError("fromTick must be a non-negative integer");
  }
  if (filters.toTick !== undefined && (!Number.isInteger(filters.toTick) || filters.toTick < 0)) {
    throw new DomainInvariantError("toTick must be a non-negative integer");
  }
  if (
    filters.fromTick !== undefined &&
    filters.toTick !== undefined &&
    filters.fromTick > filters.toTick
  ) {
    throw new DomainInvariantError("fromTick cannot be greater than toTick");
  }

  const companyExists = await prisma.company.findUnique({
    where: { id: filters.companyId },
    select: { id: true }
  });

  if (!companyExists) {
    throw new NotFoundError(`company ${filters.companyId} not found`);
  }

  const cursor = filters.cursor ? decodeLedgerCursor(filters.cursor) : null;
  const cursorCreatedAt = cursor ? new Date(cursor.createdAt) : null;

  const rows = await prisma.ledgerEntry.findMany({
    where: {
      companyId: filters.companyId,
      tick: {
        gte: filters.fromTick,
        lte: filters.toTick
      },
      entryType: filters.entryType,
      referenceType: filters.referenceType,
      referenceId: filters.referenceId
        ? { contains: filters.referenceId, mode: "insensitive" }
        : undefined,
      ...(cursor && cursorCreatedAt
        ? {
            OR: [
              {
                createdAt: {
                  lt: cursorCreatedAt
                }
              },
              {
                AND: [
                  { createdAt: cursorCreatedAt },
                  { id: { lt: cursor.id } }
                ]
              }
            ]
          }
        : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      tick: true,
      entryType: true,
      referenceType: true,
      referenceId: true,
      deltaCashCents: true,
      deltaReservedCashCents: true,
      balanceAfterCents: true,
      createdAt: true
    }
  });

  const hasMore = rows.length > limit;
  const entries = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor = hasMore
    ? encodeLedgerCursor({
        createdAt: entries[entries.length - 1]?.createdAt.toISOString() ?? "",
        id: entries[entries.length - 1]?.id ?? ""
      })
    : null;

  return {
    entries,
    nextCursor
  };
}

export async function getFinanceSummary(
  prisma: PrismaClient,
  input: FinanceSummaryInput
): Promise<FinanceSummaryOutput> {
  if (!input.companyId) {
    throw new DomainInvariantError("companyId is required");
  }

  const windowTicks = input.windowTicks ?? 100;
  if (!Number.isInteger(windowTicks) || windowTicks <= 0 || windowTicks > 10_000) {
    throw new DomainInvariantError("windowTicks must be an integer between 1 and 10000");
  }

  const [company, world] = await Promise.all([
    prisma.company.findUnique({
      where: { id: input.companyId },
      select: {
        id: true,
        cashCents: true
      }
    }),
    prisma.worldTickState.findUnique({
      where: { id: 1 },
      select: { currentTick: true }
    })
  ]);

  if (!company) {
    throw new NotFoundError(`company ${input.companyId} not found`);
  }

  const currentTick = world?.currentTick ?? 0;
  const fromTick = Math.max(0, currentTick - windowTicks + 1);
  const toTick = currentTick;

  const [entries, tradesCount, ordersPlacedCount, ordersCancelledCount, productionsCompletedCount] =
    await Promise.all([
      prisma.ledgerEntry.findMany({
        where: {
          companyId: input.companyId,
          tick: {
            gte: fromTick,
            lte: toTick
          }
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          entryType: true,
          deltaCashCents: true,
          deltaReservedCashCents: true,
          balanceAfterCents: true
        }
      }),
      prisma.trade.count({
        where: {
          tick: {
            gte: fromTick,
            lte: toTick
          },
          OR: [{ buyerCompanyId: input.companyId }, { sellerCompanyId: input.companyId }]
        }
      }),
      prisma.marketOrder.count({
        where: {
          companyId: input.companyId,
          tickPlaced: {
            gte: fromTick,
            lte: toTick
          }
        }
      }),
      prisma.marketOrder.count({
        where: {
          companyId: input.companyId,
          status: OrderStatus.CANCELLED,
          tickClosed: {
            gte: fromTick,
            lte: toTick
          }
        }
      }),
      prisma.productionJob.count({
        where: {
          companyId: input.companyId,
          status: ProductionJobStatus.COMPLETED,
          completedTick: {
            gte: fromTick,
            lte: toTick
          }
        }
      })
    ]);

  let totalDeltaCashCents = 0n;
  let totalDeltaReservedCashCents = 0n;
  const breakdown = new Map<
    LedgerEntryType,
    { entryType: LedgerEntryType; deltaCashCents: bigint; deltaReservedCashCents: bigint; count: number }
  >();

  for (const entry of entries) {
    totalDeltaCashCents += entry.deltaCashCents;
    totalDeltaReservedCashCents += entry.deltaReservedCashCents;

    const existing = breakdown.get(entry.entryType);
    if (existing) {
      existing.deltaCashCents += entry.deltaCashCents;
      existing.deltaReservedCashCents += entry.deltaReservedCashCents;
      existing.count += 1;
    } else {
      breakdown.set(entry.entryType, {
        entryType: entry.entryType,
        deltaCashCents: entry.deltaCashCents,
        deltaReservedCashCents: entry.deltaReservedCashCents,
        count: 1
      });
    }

  }

  const endingCashCents =
    entries.length > 0
      ? entries[entries.length - 1]?.balanceAfterCents ?? company.cashCents
      : company.cashCents;

  const startingCashCents = endingCashCents - totalDeltaCashCents;

  return {
    startingCashCents,
    endingCashCents,
    totalDeltaCashCents,
    totalDeltaReservedCashCents,
    breakdownByEntryType: [...breakdown.values()].sort((left, right) =>
      left.entryType.localeCompare(right.entryType)
    ),
    tradesCount,
    ordersPlacedCount,
    ordersCancelledCount,
    productionsCompletedCount
  };
}

export async function getSimulationHealth(
  prisma: PrismaClient,
  options: { invariantIssueLimit?: number } = {}
): Promise<SimulationHealthSnapshot> {
  const issueLimit = options.invariantIssueLimit ?? 20;

  const [
    world,
    ordersOpenCount,
    ordersTotalCount,
    recentTrades,
    companiesCount,
    botsCount,
    sums,
    invariants
  ] = await Promise.all([
    prisma.worldTickState.findUnique({
      where: { id: 1 },
      select: { currentTick: true, lockVersion: true, lastAdvancedAt: true }
    }),
    prisma.marketOrder.count({
      where: { status: "OPEN" }
    }),
    prisma.marketOrder.count(),
    prisma.trade.findMany({
      orderBy: [{ tick: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: { id: true }
    }),
    prisma.company.count(),
    prisma.company.count({
      where: { isPlayer: false }
    }),
    prisma.company.aggregate({
      _sum: {
        cashCents: true,
        reservedCashCents: true
      }
    }),
    scanSimulationInvariants(prisma, issueLimit)
  ]);

  return {
    currentTick: world?.currentTick ?? 0,
    lockVersion: world?.lockVersion ?? 0,
    lastAdvancedAt: world?.lastAdvancedAt ?? null,
    ordersOpenCount,
    ordersTotalCount,
    tradesLast100Count: recentTrades.length,
    companiesCount,
    botsCount,
    sumCashCents: sums._sum.cashCents ?? 0n,
    sumReservedCashCents: sums._sum.reservedCashCents ?? 0n,
    invariants
  };
}

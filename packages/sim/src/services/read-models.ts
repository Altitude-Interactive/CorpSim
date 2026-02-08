import { OrderSide, PrismaClient } from "@prisma/client";
import { DomainInvariantError, NotFoundError } from "../domain/errors";
import { scanSimulationInvariants } from "./invariants";

export interface MarketOrderFilters {
  itemId?: string;
  side?: OrderSide;
  companyId?: string;
  limit?: number;
}

export interface MarketTradeFilters {
  itemId?: string;
  companyId?: string;
  limit?: number;
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
      cashCents: true
    }
  });

  return companies.map((company) => ({
    id: company.id,
    code: company.code,
    name: company.name,
    isBot: !company.isPlayer,
    cashCents: company.cashCents
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
      createdAt: true,
      updatedAt: true
    }
  });

  if (!company) {
    throw new NotFoundError(`company ${companyId} not found`);
  }

  return {
    ...company,
    isBot: !company.isPlayer
  };
}

export async function listCompanyInventory(prisma: PrismaClient, companyId: string) {
  const companyExists = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true }
  });

  if (!companyExists) {
    throw new NotFoundError(`company ${companyId} not found`);
  }

  return prisma.inventory.findMany({
    where: { companyId },
    orderBy: { item: { code: "asc" } },
    select: {
      itemId: true,
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
      side: filters.side,
      companyId: filters.companyId
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      companyId: true,
      itemId: true,
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
      buyerCompanyId: true,
      sellerCompanyId: true,
      unitPriceCents: true,
      quantity: true,
      createdAt: true
    }
  });
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

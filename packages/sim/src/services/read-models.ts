import { OrderSide, PrismaClient } from "@prisma/client";
import { DomainInvariantError, NotFoundError } from "../domain/errors";

export interface MarketOrderFilters {
  itemId?: string;
  side?: OrderSide;
  companyId?: string;
  limit?: number;
}

export async function listCompanies(prisma: PrismaClient) {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      isPlayer: true,
      cashCents: true
    }
  });

  return companies.map((company) => ({
    id: company.id,
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
      updatedAt: true
    }
  });
}

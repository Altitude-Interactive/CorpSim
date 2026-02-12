import {
  ContractStatus,
  LedgerEntryType,
  Prisma,
  PrismaClient
} from "@prisma/client";
import {
  DomainInvariantError,
  NotFoundError,
  OptimisticLockConflictError
} from "../domain/errors";

const FALLBACK_PRICE_CENTS_BY_ITEM_CODE = new Map<string, bigint>([
  ["IRON_ORE", 80n],
  ["COAL", 55n],
  ["COPPER_ORE", 95n],
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
  ["INDUSTRIAL_PRESS", 11_500n]
]);

const FALLBACK_QUANTITY_BY_ITEM_CODE = new Map<string, number>([
  ["IRON_ORE", 24],
  ["COAL", 24],
  ["COPPER_ORE", 18],
  ["IRON_INGOT", 12],
  ["COPPER_INGOT", 10],
  ["HAND_TOOLS", 5],
  ["STEEL_INGOT", 8],
  ["STEEL_BEAM", 4],
  ["FASTENERS", 20],
  ["MACHINE_PARTS", 3],
  ["TOOL_KIT", 2],
  ["POWER_UNIT", 2],
  ["CONVEYOR_MODULE", 1],
  ["INDUSTRIAL_PRESS", 1]
]);

export interface ContractLifecycleConfig {
  contractsPerTick: number;
  ttlTicks: number;
  itemCodes?: string[];
  priceBandBps: number;
}

export interface ListContractsForPlayerInput {
  playerId: string;
  status?: ContractStatus;
  itemId?: string;
  limit?: number;
}

export interface AcceptContractInput {
  contractId: string;
  sellerCompanyId: string;
  tick?: number;
}

export interface FulfillContractInput {
  contractId: string;
  sellerCompanyId: string;
  quantity: number;
  tick?: number;
}

export interface ContractLifecycleResult {
  generatedCount: number;
  expiredCount: number;
}

export const DEFAULT_CONTRACT_LIFECYCLE_CONFIG: ContractLifecycleConfig = {
  contractsPerTick: 2,
  ttlTicks: 50,
  itemCodes: [
    "IRON_ORE",
    "COAL",
    "COPPER_ORE",
    "IRON_INGOT",
    "COPPER_INGOT",
    "HAND_TOOLS",
    "STEEL_INGOT",
    "STEEL_BEAM",
    "FASTENERS",
    "MACHINE_PARTS",
    "TOOL_KIT",
    "POWER_UNIT",
    "CONVEYOR_MODULE"
  ],
  priceBandBps: 500
};

function normalizeItemCodes(itemCodes?: string[]): string[] | undefined {
  if (!itemCodes) {
    return undefined;
  }

  const normalized = itemCodes
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  return normalized.length > 0
    ? [...new Set(normalized)].sort((left, right) => left.localeCompare(right))
    : undefined;
}

export function resolveContractLifecycleConfig(
  overrides: Partial<ContractLifecycleConfig> = {}
): ContractLifecycleConfig {
  const itemCodes = normalizeItemCodes(
    overrides.itemCodes ?? DEFAULT_CONTRACT_LIFECYCLE_CONFIG.itemCodes
  );
  const contractsPerTick =
    overrides.contractsPerTick ?? DEFAULT_CONTRACT_LIFECYCLE_CONFIG.contractsPerTick;
  const ttlTicks = overrides.ttlTicks ?? DEFAULT_CONTRACT_LIFECYCLE_CONFIG.ttlTicks;
  const priceBandBps = overrides.priceBandBps ?? DEFAULT_CONTRACT_LIFECYCLE_CONFIG.priceBandBps;

  if (!Number.isInteger(contractsPerTick) || contractsPerTick < 0) {
    throw new DomainInvariantError("contractsPerTick must be a non-negative integer");
  }
  if (!Number.isInteger(ttlTicks) || ttlTicks <= 0) {
    throw new DomainInvariantError("ttlTicks must be a positive integer");
  }
  if (!Number.isInteger(priceBandBps) || priceBandBps < 0) {
    throw new DomainInvariantError("priceBandBps must be a non-negative integer");
  }

  return {
    contractsPerTick,
    ttlTicks,
    itemCodes,
    priceBandBps
  };
}

export function shouldExpireContract(currentTick: number, tickExpires: number): boolean {
  if (!Number.isInteger(currentTick) || currentTick < 0) {
    throw new DomainInvariantError("currentTick must be a non-negative integer");
  }
  if (!Number.isInteger(tickExpires) || tickExpires < 0) {
    throw new DomainInvariantError("tickExpires must be a non-negative integer");
  }

  return currentTick >= tickExpires;
}

export function resolveContractUnitPriceCents(input: {
  itemCode: string;
  recentTradeAverageCents?: bigint;
  priceBandBps: number;
  tick: number;
  sequence: number;
}): bigint {
  const basePrice =
    input.recentTradeAverageCents ??
    FALLBACK_PRICE_CENTS_BY_ITEM_CODE.get(input.itemCode) ??
    100n;

  if (basePrice <= 0n) {
    return 1n;
  }

  const direction = (input.tick + input.sequence) % 2 === 0 ? 1n : -1n;
  const adjustment = (basePrice * BigInt(input.priceBandBps) * direction) / 10_000n;
  const price = basePrice + adjustment;

  return price > 0n ? price : 1n;
}

function resolveContractQuantity(itemCode: string, tick: number, sequence: number): number {
  const baseQuantity = FALLBACK_QUANTITY_BY_ITEM_CODE.get(itemCode) ?? 5;
  return baseQuantity + ((tick + sequence) % 3);
}

function resolveTickFromWorld(world: { currentTick: number } | null): number {
  return world?.currentTick ?? 0;
}

async function resolveTick(
  tx: Prisma.TransactionClient,
  explicitTick?: number
): Promise<number> {
  if (explicitTick !== undefined) {
    if (!Number.isInteger(explicitTick) || explicitTick < 0) {
      throw new DomainInvariantError("tick must be a non-negative integer");
    }
    return explicitTick;
  }

  const world = await tx.worldTickState.findUnique({
    where: { id: 1 },
    select: { currentTick: true }
  });
  return resolveTickFromWorld(world);
}

async function loadRecentTradeAveragesByItem(
  tx: Prisma.TransactionClient,
  itemIds: string[]
): Promise<Map<string, bigint>> {
  if (itemIds.length === 0) {
    return new Map<string, bigint>();
  }

  const recentTrades = await tx.trade.findMany({
    where: {
      itemId: { in: itemIds }
    },
    orderBy: [{ tick: "desc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      itemId: true,
      unitPriceCents: true
    }
  });

  const totals = new Map<string, { total: bigint; count: bigint }>();
  for (const trade of recentTrades) {
    const existing = totals.get(trade.itemId) ?? { total: 0n, count: 0n };
    existing.total += trade.unitPriceCents;
    existing.count += 1n;
    totals.set(trade.itemId, existing);
  }

  const averages = new Map<string, bigint>();
  for (const [itemId, aggregate] of totals.entries()) {
    if (aggregate.count === 0n) {
      continue;
    }
    averages.set(itemId, aggregate.total / aggregate.count);
  }

  return averages;
}

export async function listContractsForPlayer(
  prisma: PrismaClient,
  input: ListContractsForPlayerInput
) {
  if (!input.playerId) {
    throw new DomainInvariantError("playerId is required");
  }

  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new DomainInvariantError("limit must be an integer between 1 and 500");
  }

  return prisma.contract.findMany({
    where: {
      itemId: input.itemId,
      status: input.status,
      OR: [
        { status: ContractStatus.OPEN },
        { sellerCompany: { ownerPlayerId: input.playerId } }
      ]
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      buyerCompany: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      sellerCompany: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  });
}

export async function acceptContract(prisma: PrismaClient, input: AcceptContractInput) {
  if (!input.contractId) {
    throw new DomainInvariantError("contractId is required");
  }
  if (!input.sellerCompanyId) {
    throw new DomainInvariantError("sellerCompanyId is required");
  }

  return prisma.$transaction(async (tx) => {
    const tick = await resolveTick(tx, input.tick);

    const contract = await tx.contract.findUnique({
      where: { id: input.contractId },
      include: {
        buyerCompany: {
          select: {
            id: true,
            isPlayer: true,
            ownerPlayerId: true
          }
        }
      }
    });

    if (!contract) {
      throw new NotFoundError(`contract ${input.contractId} not found`);
    }
    if (contract.status !== ContractStatus.OPEN) {
      throw new DomainInvariantError("contract is not open");
    }
    if (shouldExpireContract(tick, contract.tickExpires)) {
      throw new DomainInvariantError("contract is expired");
    }
    if (contract.buyerCompany.isPlayer || contract.buyerCompany.ownerPlayerId !== null) {
      throw new DomainInvariantError("contract buyer company must be an NPC company");
    }

    const updated = await tx.contract.updateMany({
      where: {
        id: contract.id,
        status: ContractStatus.OPEN,
        sellerCompanyId: null,
        tickExpires: { gt: tick }
      },
      data: {
        sellerCompanyId: input.sellerCompanyId,
        status: ContractStatus.ACCEPTED,
        tickAccepted: tick
      }
    });

    if (updated.count !== 1) {
      throw new OptimisticLockConflictError(
        "contract changed while attempting to accept; retry operation"
      );
    }

    const accepted = await tx.contract.findUnique({
      where: { id: contract.id },
      include: {
        item: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        buyerCompany: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        sellerCompany: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    if (!accepted) {
      throw new NotFoundError(`contract ${input.contractId} not found`);
    }

    return accepted;
  });
}

export async function fulfillContract(prisma: PrismaClient, input: FulfillContractInput) {
  if (!input.contractId) {
    throw new DomainInvariantError("contractId is required");
  }
  if (!input.sellerCompanyId) {
    throw new DomainInvariantError("sellerCompanyId is required");
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new DomainInvariantError("quantity must be a positive integer");
  }

  return prisma.$transaction(async (tx) => {
    const tick = await resolveTick(tx, input.tick);

    const contract = await tx.contract.findUnique({
      where: { id: input.contractId },
      include: {
        buyerCompany: {
          select: {
            id: true,
            isPlayer: true,
            ownerPlayerId: true,
            cashCents: true,
            regionId: true
          }
        }
      }
    });

    if (!contract) {
      throw new NotFoundError(`contract ${input.contractId} not found`);
    }
    if (
      contract.status !== ContractStatus.ACCEPTED &&
      contract.status !== ContractStatus.PARTIALLY_FULFILLED
    ) {
      throw new DomainInvariantError("contract is not fulfillable");
    }
    if (contract.sellerCompanyId !== input.sellerCompanyId) {
      throw new DomainInvariantError("contract is not accepted by this seller company");
    }
    if (shouldExpireContract(tick, contract.tickExpires)) {
      throw new DomainInvariantError("contract is expired");
    }
    if (input.quantity > contract.remainingQuantity) {
      throw new DomainInvariantError("fulfillment quantity exceeds contract remaining quantity");
    }
    if (contract.buyerCompany.isPlayer || contract.buyerCompany.ownerPlayerId !== null) {
      throw new DomainInvariantError("contract buyer company must be an NPC company");
    }

    const sellerCompany = await tx.company.findUnique({
      where: { id: input.sellerCompanyId },
      select: {
        id: true,
        cashCents: true,
        regionId: true
      }
    });

    if (!sellerCompany) {
      throw new NotFoundError(`company ${input.sellerCompanyId} not found`);
    }

    const sellerInventory = await tx.inventory.findUnique({
      where: {
        companyId_itemId_regionId: {
          companyId: input.sellerCompanyId,
          itemId: contract.itemId,
          regionId: sellerCompany.regionId
        }
      },
      select: {
        companyId: true,
        itemId: true,
        quantity: true,
        reservedQuantity: true
      }
    });

    if (!sellerInventory) {
      throw new DomainInvariantError("seller company has no inventory for contract item");
    }

    const availableQuantity = sellerInventory.quantity - sellerInventory.reservedQuantity;
    if (availableQuantity < input.quantity) {
      throw new DomainInvariantError("insufficient available inventory for contract fulfillment");
    }

    const totalNotional = contract.priceCents * BigInt(input.quantity);
    if (contract.buyerCompany.cashCents < totalNotional) {
      throw new DomainInvariantError("buyer company has insufficient cash for contract settlement");
    }

    const sellerInventoryUpdated = await tx.inventory.updateMany({
      where: {
        companyId: sellerInventory.companyId,
        itemId: sellerInventory.itemId,
        quantity: sellerInventory.quantity,
        reservedQuantity: sellerInventory.reservedQuantity
      },
      data: {
        quantity: {
          decrement: input.quantity
        }
      }
    });

    if (sellerInventoryUpdated.count !== 1) {
      throw new OptimisticLockConflictError(
        "seller inventory changed during contract fulfillment; retry operation"
      );
    }

    await tx.inventory.upsert({
      where: {
        companyId_itemId_regionId: {
          companyId: contract.buyerCompanyId,
          itemId: contract.itemId,
          regionId: contract.buyerCompany.regionId
        }
      },
      create: {
        companyId: contract.buyerCompanyId,
        itemId: contract.itemId,
        regionId: contract.buyerCompany.regionId,
        quantity: input.quantity,
        reservedQuantity: 0
      },
      update: {
        quantity: {
          increment: input.quantity
        }
      }
    });

    const buyerUpdated = await tx.company.updateMany({
      where: {
        id: contract.buyerCompanyId,
        cashCents: { gte: totalNotional }
      },
      data: {
        cashCents: {
          decrement: totalNotional
        }
      }
    });

    if (buyerUpdated.count !== 1) {
      throw new OptimisticLockConflictError(
        "buyer company changed during contract fulfillment; retry operation"
      );
    }

    await tx.company.update({
      where: { id: input.sellerCompanyId },
      data: {
        cashCents: {
          increment: totalNotional
        }
      }
    });

    const fulfillment = await tx.contractFulfillment.create({
      data: {
        contractId: contract.id,
        sellerCompanyId: input.sellerCompanyId,
        itemId: contract.itemId,
        quantity: input.quantity,
        priceCents: contract.priceCents,
        tick
      }
    });

    const nextRemainingQuantity = contract.remainingQuantity - input.quantity;
    if (nextRemainingQuantity < 0) {
      throw new DomainInvariantError("contract remainingQuantity cannot become negative");
    }

    const nextStatus =
      nextRemainingQuantity === 0
        ? ContractStatus.FULFILLED
        : ContractStatus.PARTIALLY_FULFILLED;

    const contractUpdated = await tx.contract.updateMany({
      where: {
        id: contract.id,
        sellerCompanyId: input.sellerCompanyId,
        remainingQuantity: contract.remainingQuantity,
        status: {
          in: [ContractStatus.ACCEPTED, ContractStatus.PARTIALLY_FULFILLED]
        }
      },
      data: {
        remainingQuantity: nextRemainingQuantity,
        status: nextStatus,
        tickClosed: nextStatus === ContractStatus.FULFILLED ? tick : null
      }
    });

    if (contractUpdated.count !== 1) {
      throw new OptimisticLockConflictError(
        "contract changed during fulfillment; retry operation"
      );
    }

    const [buyerAfter, sellerAfter] = await Promise.all([
      tx.company.findUnique({
        where: { id: contract.buyerCompanyId },
        select: {
          id: true,
          cashCents: true
        }
      }),
      tx.company.findUnique({
        where: { id: input.sellerCompanyId },
        select: {
          id: true,
          cashCents: true
        }
      })
    ]);

    if (!buyerAfter || !sellerAfter) {
      throw new NotFoundError("company missing during contract ledger write");
    }

    await tx.ledgerEntry.createMany({
      data: [
        {
          companyId: buyerAfter.id,
          tick,
          entryType: LedgerEntryType.CONTRACT_SETTLEMENT,
          deltaCashCents: -totalNotional,
          deltaReservedCashCents: 0n,
          balanceAfterCents: buyerAfter.cashCents,
          referenceType: "CONTRACT_BUY",
          referenceId: fulfillment.id
        },
        {
          companyId: sellerAfter.id,
          tick,
          entryType: LedgerEntryType.CONTRACT_SETTLEMENT,
          deltaCashCents: totalNotional,
          deltaReservedCashCents: 0n,
          balanceAfterCents: sellerAfter.cashCents,
          referenceType: "CONTRACT_SELL",
          referenceId: fulfillment.id
        }
      ]
    });

    const updatedContract = await tx.contract.findUnique({
      where: { id: contract.id },
      include: {
        item: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        buyerCompany: {
          select: {
            id: true,
            code: true,
            name: true
          }
        },
        sellerCompany: {
          select: {
            id: true,
            code: true,
            name: true
          }
        }
      }
    });

    if (!updatedContract) {
      throw new NotFoundError(`contract ${input.contractId} not found`);
    }

    return {
      contract: updatedContract,
      fulfillment
    };
  });
}

export async function expireContractsForTick(
  tx: Prisma.TransactionClient,
  tick: number
): Promise<number> {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new DomainInvariantError("tick must be a non-negative integer");
  }

  const result = await tx.contract.updateMany({
    where: {
      status: {
        in: [
          ContractStatus.OPEN,
          ContractStatus.ACCEPTED,
          ContractStatus.PARTIALLY_FULFILLED
        ]
      },
      tickExpires: {
        lte: tick
      }
    },
    data: {
      status: ContractStatus.EXPIRED,
      tickClosed: tick
    }
  });

  return result.count;
}

export async function generateContractsForTick(
  tx: Prisma.TransactionClient,
  tick: number,
  overrides: Partial<ContractLifecycleConfig> = {}
): Promise<number> {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new DomainInvariantError("tick must be a non-negative integer");
  }

  const config = resolveContractLifecycleConfig(overrides);
  if (config.contractsPerTick === 0) {
    return 0;
  }

  const [items, botCompanies] = await Promise.all([
    tx.item.findMany({
      where: config.itemCodes ? { code: { in: config.itemCodes } } : undefined,
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true
      }
    }),
    tx.company.findMany({
      where: {
        isPlayer: false,
        ownerPlayerId: null
      },
      orderBy: { code: "asc" },
      select: {
        id: true,
        cashCents: true
      }
    })
  ]);

  if (items.length === 0 || botCompanies.length === 0) {
    return 0;
  }

  const recentAveragesByItemId = await loadRecentTradeAveragesByItem(
    tx,
    items.map((item) => item.id)
  );

  let createdCount = 0;
  for (let i = 0; i < config.contractsPerTick; i += 1) {
    const item = items[(tick + i) % items.length];
    const buyerCompany = botCompanies[(tick + i * 3) % botCompanies.length];
    const unitPriceCents = resolveContractUnitPriceCents({
      itemCode: item.code,
      recentTradeAverageCents: recentAveragesByItemId.get(item.id),
      priceBandBps: config.priceBandBps,
      tick,
      sequence: i
    });
    const quantity = resolveContractQuantity(item.code, tick, i);
    const totalNotional = unitPriceCents * BigInt(quantity);

    if (buyerCompany.cashCents < totalNotional) {
      continue;
    }

    await tx.contract.create({
      data: {
        buyerCompanyId: buyerCompany.id,
        itemId: item.id,
        quantity,
        remainingQuantity: quantity,
        priceCents: unitPriceCents,
        status: ContractStatus.OPEN,
        tickCreated: tick,
        tickExpires: tick + config.ttlTicks
      }
    });

    createdCount += 1;
  }

  return createdCount;
}

export async function runContractLifecycleForTick(
  tx: Prisma.TransactionClient,
  tick: number,
  overrides: Partial<ContractLifecycleConfig> = {}
): Promise<ContractLifecycleResult> {
  const expiredCount = await expireContractsForTick(tx, tick);
  const generatedCount = await generateContractsForTick(tx, tick, overrides);

  return {
    generatedCount,
    expiredCount
  };
}

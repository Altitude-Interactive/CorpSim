import {
  LedgerEntryType,
  Prisma,
  PrismaClient,
  ShipmentStatus
} from "@prisma/client";
import {
  DomainInvariantError,
  NotFoundError,
  OptimisticLockConflictError
} from "../domain/errors";

export interface ShipmentRuntimeConfig {
  baseFeeCents: bigint;
  feePerUnitCents: bigint;
}

export interface CreateShipmentInput {
  companyId: string;
  toRegionId: string;
  itemId: string;
  quantity: number;
  tick?: number;
}

export interface CancelShipmentInput {
  shipmentId: string;
  tick?: number;
}

export interface ListShipmentsInput {
  playerId?: string;
  companyId?: string;
  status?: ShipmentStatus;
  limit?: number;
}

const DEFAULT_SHIPMENT_RUNTIME_CONFIG: ShipmentRuntimeConfig = {
  baseFeeCents: 250n,
  feePerUnitCents: 15n
};

const TRAVEL_TIME_BY_REGION_PAIR = new Map<string, number>([
  ["CORE:INDUSTRIAL", 5],
  ["CORE:FRONTIER", 10],
  ["FRONTIER:INDUSTRIAL", 7]
]);

function pairKey(leftCode: string, rightCode: string): string {
  return [leftCode, rightCode].sort((a, b) => a.localeCompare(b)).join(":");
}

function ensureTick(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainInvariantError(`${fieldName} must be a non-negative integer`);
  }
}

function resolveTravelTimeTicks(fromRegionCode: string, toRegionCode: string): number {
  const key = pairKey(fromRegionCode, toRegionCode);
  const travelTime = TRAVEL_TIME_BY_REGION_PAIR.get(key);
  if (travelTime === undefined) {
    throw new DomainInvariantError(
      `unsupported region travel path ${fromRegionCode} -> ${toRegionCode}`
    );
  }

  return travelTime;
}

export function resolveShipmentRuntimeConfig(
  overrides: Partial<ShipmentRuntimeConfig> = {}
): ShipmentRuntimeConfig {
  const baseFeeCents = overrides.baseFeeCents ?? DEFAULT_SHIPMENT_RUNTIME_CONFIG.baseFeeCents;
  const feePerUnitCents =
    overrides.feePerUnitCents ?? DEFAULT_SHIPMENT_RUNTIME_CONFIG.feePerUnitCents;

  if (baseFeeCents < 0n) {
    throw new DomainInvariantError("baseFeeCents must be non-negative");
  }
  if (feePerUnitCents < 0n) {
    throw new DomainInvariantError("feePerUnitCents must be non-negative");
  }

  return {
    baseFeeCents,
    feePerUnitCents
  };
}

export function computeShipmentFeeCents(
  quantity: number,
  config: ShipmentRuntimeConfig
): bigint {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new DomainInvariantError("quantity must be a positive integer");
  }

  return config.baseFeeCents + config.feePerUnitCents * BigInt(quantity);
}

async function resolveTick(
  tx: Prisma.TransactionClient,
  explicitTick?: number
): Promise<number> {
  if (explicitTick !== undefined) {
    ensureTick(explicitTick, "tick");
    return explicitTick;
  }

  const world = await tx.worldTickState.findUnique({
    where: { id: 1 },
    select: { currentTick: true }
  });

  return world?.currentTick ?? 0;
}

export async function listShipments(
  prisma: PrismaClient,
  input: ListShipmentsInput = {}
) {
  const limit = input.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new DomainInvariantError("limit must be an integer between 1 and 500");
  }

  return prisma.shipment.findMany({
    where: {
      companyId: input.companyId,
      company: input.playerId
        ? {
            ownerPlayerId: input.playerId
          }
        : undefined,
      status: input.status
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
      fromRegion: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      toRegion: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  });
}

export async function createShipment(
  prisma: PrismaClient,
  input: CreateShipmentInput,
  overrides: Partial<ShipmentRuntimeConfig> = {}
) {
  return prisma.$transaction(async (tx) => {
    return createShipmentWithTx(tx, input, overrides);
  });
}

export async function createShipmentWithTx(
  tx: Prisma.TransactionClient,
  input: CreateShipmentInput,
  overrides: Partial<ShipmentRuntimeConfig> = {}
) {
  if (!input.companyId) {
    throw new DomainInvariantError("companyId is required");
  }
  if (!input.toRegionId) {
    throw new DomainInvariantError("toRegionId is required");
  }
  if (!input.itemId) {
    throw new DomainInvariantError("itemId is required");
  }
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new DomainInvariantError("quantity must be a positive integer");
  }

  const tick = await resolveTick(tx, input.tick);
  const config = resolveShipmentRuntimeConfig(overrides);

  const [company, toRegion, item] = await Promise.all([
    tx.company.findUnique({
      where: { id: input.companyId },
      select: {
        id: true,
        regionId: true,
        cashCents: true,
        reservedCashCents: true
      }
    }),
    tx.region.findUnique({
      where: { id: input.toRegionId },
      select: {
        id: true,
        code: true
      }
    }),
    tx.item.findUnique({
      where: { id: input.itemId },
      select: { id: true }
    })
  ]);

  if (!company) {
    throw new NotFoundError(`company ${input.companyId} not found`);
  }
  if (!toRegion) {
    throw new NotFoundError(`region ${input.toRegionId} not found`);
  }
  if (!item) {
    throw new NotFoundError(`item ${input.itemId} not found`);
  }

  if (company.regionId === toRegion.id) {
    throw new DomainInvariantError("toRegionId must differ from company region");
  }

  const fromRegion = await tx.region.findUnique({
    where: { id: company.regionId },
    select: {
      id: true,
      code: true
    }
  });

  if (!fromRegion) {
    throw new NotFoundError(`region ${company.regionId} not found`);
  }

  const travelTimeTicks = resolveTravelTimeTicks(fromRegion.code, toRegion.code);
  const feeCents = computeShipmentFeeCents(input.quantity, config);

  const fromInventory = await tx.inventory.findUnique({
    where: {
      companyId_itemId_regionId: {
        companyId: company.id,
        itemId: input.itemId,
        regionId: fromRegion.id
      }
    },
    select: {
      companyId: true,
      itemId: true,
      regionId: true,
      quantity: true,
      reservedQuantity: true
    }
  });

  if (!fromInventory) {
    throw new DomainInvariantError(
      `company ${company.id} has no inventory row for item ${input.itemId} in region ${fromRegion.code}`
    );
  }

  const availableQuantity = fromInventory.quantity - fromInventory.reservedQuantity;
  if (availableQuantity < input.quantity) {
    throw new DomainInvariantError("insufficient available inventory for shipment");
  }

  const cashAfterFee = company.cashCents - feeCents;
  if (cashAfterFee < 0n || cashAfterFee < company.reservedCashCents) {
    throw new DomainInvariantError("insufficient available cash for shipment fee");
  }

  const inventoryUpdate = await tx.inventory.updateMany({
    where: {
      companyId: fromInventory.companyId,
      itemId: fromInventory.itemId,
      regionId: fromInventory.regionId,
      quantity: fromInventory.quantity,
      reservedQuantity: fromInventory.reservedQuantity
    },
    data: {
      quantity: {
        decrement: input.quantity
      }
    }
  });

  if (inventoryUpdate.count !== 1) {
    throw new OptimisticLockConflictError(
      "inventory changed during shipment creation; retry operation"
    );
  }

  const companyUpdate = await tx.company.updateMany({
    where: {
      id: company.id,
      cashCents: company.cashCents,
      reservedCashCents: company.reservedCashCents
    },
    data: {
      cashCents: cashAfterFee
    }
  });

  if (companyUpdate.count !== 1) {
    throw new OptimisticLockConflictError(
      "company changed during shipment creation; retry operation"
    );
  }

  const shipment = await tx.shipment.create({
    data: {
      companyId: company.id,
      fromRegionId: fromRegion.id,
      toRegionId: toRegion.id,
      itemId: input.itemId,
      quantity: input.quantity,
      status: ShipmentStatus.IN_TRANSIT,
      tickCreated: tick,
      tickArrives: tick + travelTimeTicks
    },
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      fromRegion: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      toRegion: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  });

  await tx.ledgerEntry.create({
    data: {
      companyId: company.id,
      tick,
      entryType: LedgerEntryType.SHIPMENT_FEE,
      deltaCashCents: -feeCents,
      deltaReservedCashCents: 0n,
      balanceAfterCents: cashAfterFee,
      referenceType: "SHIPMENT_CREATE",
      referenceId: shipment.id
    }
  });

  return shipment;
}

export async function cancelShipment(
  prisma: PrismaClient,
  input: CancelShipmentInput
) {
  return prisma.$transaction(async (tx) => {
    return cancelShipmentWithTx(tx, input);
  });
}

export async function cancelShipmentWithTx(
  tx: Prisma.TransactionClient,
  input: CancelShipmentInput
) {
  if (!input.shipmentId) {
    throw new DomainInvariantError("shipmentId is required");
  }

  const tick = await resolveTick(tx, input.tick);

  const shipment = await tx.shipment.findUnique({
    where: { id: input.shipmentId },
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      fromRegion: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      toRegion: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  });

  if (!shipment) {
    throw new NotFoundError(`shipment ${input.shipmentId} not found`);
  }

  if (shipment.status !== ShipmentStatus.IN_TRANSIT) {
    return shipment;
  }

  const updated = await tx.shipment.updateMany({
    where: {
      id: shipment.id,
      status: ShipmentStatus.IN_TRANSIT
    },
    data: {
      status: ShipmentStatus.CANCELLED,
      tickClosed: tick
    }
  });

  if (updated.count !== 1) {
    throw new OptimisticLockConflictError(
      "shipment changed during cancel; retry operation"
    );
  }

  await tx.inventory.upsert({
    where: {
      companyId_itemId_regionId: {
        companyId: shipment.companyId,
        itemId: shipment.itemId,
        regionId: shipment.fromRegionId
      }
    },
    create: {
      companyId: shipment.companyId,
      itemId: shipment.itemId,
      regionId: shipment.fromRegionId,
      quantity: shipment.quantity,
      reservedQuantity: 0
    },
    update: {
      quantity: {
        increment: shipment.quantity
      }
    }
  });

  const cancelled = await tx.shipment.findUnique({
    where: { id: shipment.id },
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      fromRegion: {
        select: {
          id: true,
          code: true,
          name: true
        }
      },
      toRegion: {
        select: {
          id: true,
          code: true,
          name: true
        }
      }
    }
  });

  if (!cancelled) {
    throw new NotFoundError(`shipment ${input.shipmentId} not found`);
  }

  return cancelled;
}

export async function deliverDueShipmentsForTick(
  tx: Prisma.TransactionClient,
  tick: number
): Promise<number> {
  ensureTick(tick, "tick");

  const dueShipments = await tx.shipment.findMany({
    where: {
      status: ShipmentStatus.IN_TRANSIT,
      tickArrives: {
        lte: tick
      }
    },
    orderBy: [{ tickArrives: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      companyId: true,
      fromRegionId: true,
      toRegionId: true,
      itemId: true,
      quantity: true
    }
  });

  let deliveredCount = 0;

  for (const shipment of dueShipments) {
    const updated = await tx.shipment.updateMany({
      where: {
        id: shipment.id,
        status: ShipmentStatus.IN_TRANSIT
      },
      data: {
        status: ShipmentStatus.DELIVERED,
        tickClosed: tick
      }
    });

    if (updated.count !== 1) {
      continue;
    }

    await tx.inventory.upsert({
      where: {
        companyId_itemId_regionId: {
          companyId: shipment.companyId,
          itemId: shipment.itemId,
          regionId: shipment.toRegionId
        }
      },
      create: {
        companyId: shipment.companyId,
        itemId: shipment.itemId,
        regionId: shipment.toRegionId,
        quantity: shipment.quantity,
        reservedQuantity: 0
      },
      update: {
        quantity: {
          increment: shipment.quantity
        }
      }
    });

    deliveredCount += 1;
  }

  return deliveredCount;
}

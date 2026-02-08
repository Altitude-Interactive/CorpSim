import {
  LedgerEntryType,
  OrderSide,
  OrderStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { DomainInvariantError, NotFoundError } from "../domain/errors";
import {
  reserveCashForBuyOrder,
  reserveInventoryForSellOrder
} from "../domain/reservations";

export interface PlaceMarketOrderInput {
  companyId: string;
  itemId: string;
  side: OrderSide;
  quantity: number;
  unitPriceCents: bigint;
  tick?: number;
}

export interface CancelMarketOrderInput {
  orderId: string;
  tick?: number;
}

function validateOrderInput(input: PlaceMarketOrderInput): void {
  if (!input.companyId) {
    throw new DomainInvariantError("companyId is required");
  }

  if (!input.itemId) {
    throw new DomainInvariantError("itemId is required");
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new DomainInvariantError("quantity must be a positive integer");
  }

  if (input.unitPriceCents <= 0n) {
    throw new DomainInvariantError("unitPriceCents must be greater than zero");
  }

  if (input.tick !== undefined && (!Number.isInteger(input.tick) || input.tick < 0)) {
    throw new DomainInvariantError("tick must be a non-negative integer");
  }
}

function validateCancelInput(input: CancelMarketOrderInput): void {
  if (!input.orderId) {
    throw new DomainInvariantError("orderId is required");
  }

  if (input.tick !== undefined && (!Number.isInteger(input.tick) || input.tick < 0)) {
    throw new DomainInvariantError("tick must be a non-negative integer");
  }
}

async function resolveTick(tx: Prisma.TransactionClient, explicitTick?: number): Promise<number> {
  if (explicitTick !== undefined) {
    return explicitTick;
  }

  const world = await tx.worldTickState.findUnique({
    where: { id: 1 },
    select: { currentTick: true }
  });

  return world?.currentTick ?? 0;
}

async function createBuyReserveLedgerEntry(
  tx: Prisma.TransactionClient,
  params: {
    companyId: string;
    referenceId: string;
    tick: number;
    deltaCashCents: bigint;
    balanceAfterCents: bigint;
    referenceType: string;
  }
): Promise<void> {
  await tx.ledgerEntry.create({
    data: {
      companyId: params.companyId,
      tick: params.tick,
      entryType: LedgerEntryType.ORDER_RESERVE,
      deltaCashCents: params.deltaCashCents,
      balanceAfterCents: params.balanceAfterCents,
      referenceType: params.referenceType,
      referenceId: params.referenceId
    }
  });
}

export async function placeMarketOrder(prisma: PrismaClient, input: PlaceMarketOrderInput) {
  validateOrderInput(input);

  return prisma.$transaction(async (tx) => {
    const tick = await resolveTick(tx, input.tick);

    const company = await tx.company.findUnique({
      where: { id: input.companyId },
      select: { id: true, cashCents: true, reservedCashCents: true }
    });

    if (!company) {
      throw new NotFoundError(`company ${input.companyId} not found`);
    }

    const item = await tx.item.findUnique({
      where: { id: input.itemId },
      select: { id: true }
    });

    if (!item) {
      throw new NotFoundError(`item ${input.itemId} not found`);
    }

    if (input.side === OrderSide.BUY) {
      const cashState = reserveCashForBuyOrder(
        {
          cashCents: company.cashCents,
          reservedCashCents: company.reservedCashCents
        },
        input.quantity,
        input.unitPriceCents
      );

      const reservedCash = cashState.reservedCashCents - company.reservedCashCents;
      const availableAfter = company.cashCents - cashState.reservedCashCents;

      await tx.company.update({
        where: { id: company.id },
        data: { reservedCashCents: cashState.reservedCashCents }
      });

      const order = await tx.marketOrder.create({
        data: {
          companyId: input.companyId,
          itemId: input.itemId,
          side: input.side,
          quantity: input.quantity,
          remainingQuantity: input.quantity,
          unitPriceCents: input.unitPriceCents,
          reservedCashCents: reservedCash,
          reservedQuantity: 0,
          tickPlaced: tick
        }
      });

      await createBuyReserveLedgerEntry(tx, {
        companyId: company.id,
        referenceId: order.id,
        tick,
        deltaCashCents: -reservedCash,
        balanceAfterCents: availableAfter,
        referenceType: "MARKET_ORDER_BUY_RESERVE"
      });

      return order;
    }

    const inventory = await tx.inventory.findUnique({
      where: {
        companyId_itemId: {
          companyId: input.companyId,
          itemId: input.itemId
        }
      },
      select: {
        companyId: true,
        itemId: true,
        quantity: true,
        reservedQuantity: true
      }
    });

    if (!inventory) {
      throw new DomainInvariantError(
        `company ${input.companyId} has no inventory row for item ${input.itemId}`
      );
    }

    const inventoryState = reserveInventoryForSellOrder(
      {
        quantity: inventory.quantity,
        reservedQuantity: inventory.reservedQuantity
      },
      input.quantity
    );

    await tx.inventory.update({
      where: {
        companyId_itemId: {
          companyId: inventory.companyId,
          itemId: inventory.itemId
        }
      },
      data: { reservedQuantity: inventoryState.reservedQuantity }
    });

    return tx.marketOrder.create({
      data: {
        companyId: input.companyId,
        itemId: input.itemId,
        side: input.side,
        quantity: input.quantity,
        remainingQuantity: input.quantity,
        unitPriceCents: input.unitPriceCents,
        reservedCashCents: 0n,
        reservedQuantity: input.quantity,
        tickPlaced: tick
      }
    });
  });
}

export async function cancelMarketOrder(prisma: PrismaClient, input: CancelMarketOrderInput) {
  validateCancelInput(input);

  return prisma.$transaction(async (tx) => {
    const tick = await resolveTick(tx, input.tick);

    const existingOrder = await tx.marketOrder.findUnique({
      where: { id: input.orderId }
    });

    if (!existingOrder) {
      throw new NotFoundError(`market order ${input.orderId} not found`);
    }

    if (existingOrder.status !== OrderStatus.OPEN) {
      return existingOrder;
    }

    if (existingOrder.side === OrderSide.BUY && existingOrder.reservedCashCents > 0n) {
      const company = await tx.company.findUnique({
        where: { id: existingOrder.companyId },
        select: {
          id: true,
          cashCents: true,
          reservedCashCents: true
        }
      });

      if (!company) {
        throw new NotFoundError(`company ${existingOrder.companyId} not found`);
      }

      const nextReservedCash = company.reservedCashCents - existingOrder.reservedCashCents;

      if (nextReservedCash < 0n) {
        throw new DomainInvariantError("company reserved cash cannot become negative");
      }

      await tx.company.update({
        where: { id: company.id },
        data: { reservedCashCents: nextReservedCash }
      });

      await createBuyReserveLedgerEntry(tx, {
        companyId: company.id,
        referenceId: existingOrder.id,
        tick,
        deltaCashCents: existingOrder.reservedCashCents,
        balanceAfterCents: company.cashCents - nextReservedCash,
        referenceType: "MARKET_ORDER_BUY_RELEASE"
      });
    }

    if (existingOrder.side === OrderSide.SELL && existingOrder.reservedQuantity > 0) {
      const inventory = await tx.inventory.findUnique({
        where: {
          companyId_itemId: {
            companyId: existingOrder.companyId,
            itemId: existingOrder.itemId
          }
        },
        select: {
          companyId: true,
          itemId: true,
          reservedQuantity: true
        }
      });

      if (!inventory) {
        throw new DomainInvariantError(
          `company ${existingOrder.companyId} has no inventory row for item ${existingOrder.itemId}`
        );
      }

      const nextReservedQuantity = inventory.reservedQuantity - existingOrder.reservedQuantity;

      if (nextReservedQuantity < 0) {
        throw new DomainInvariantError("inventory reserved quantity cannot become negative");
      }

      await tx.inventory.update({
        where: {
          companyId_itemId: {
            companyId: inventory.companyId,
            itemId: inventory.itemId
          }
        },
        data: {
          reservedQuantity: nextReservedQuantity
        }
      });
    }

    return tx.marketOrder.update({
      where: { id: existingOrder.id },
      data: {
        status: OrderStatus.CANCELLED,
        tickClosed: tick,
        closedAt: new Date(),
        reservedCashCents: 0n,
        reservedQuantity: 0
      }
    });
  });
}

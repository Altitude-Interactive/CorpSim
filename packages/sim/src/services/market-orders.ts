import { OrderSide, PrismaClient } from "@prisma/client";
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
  tick: number;
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

  if (!Number.isInteger(input.tick) || input.tick < 0) {
    throw new DomainInvariantError("tick must be a non-negative integer");
  }
}

export async function placeMarketOrder(
  prisma: PrismaClient,
  input: PlaceMarketOrderInput
) {
  validateOrderInput(input);

  return prisma.$transaction(async (tx) => {
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

      await tx.company.update({
        where: { id: company.id },
        data: { reservedCashCents: cashState.reservedCashCents }
      });

      return tx.marketOrder.create({
        data: {
          companyId: input.companyId,
          itemId: input.itemId,
          side: input.side,
          quantity: input.quantity,
          remainingQuantity: input.quantity,
          unitPriceCents: input.unitPriceCents,
          reservedCashCents: reservedCash,
          reservedQuantity: 0,
          tickPlaced: input.tick
        }
      });
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
        tickPlaced: input.tick
      }
    });
  });
}

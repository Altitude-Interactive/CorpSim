import { Inject, Injectable } from "@nestjs/common";
import { listMarketOrders } from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

export interface MarketOrderFilterInput {
  itemId?: string;
  side?: "BUY" | "SELL";
  companyId?: string;
  limit?: number;
}

@Injectable()
export class MarketService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listOrders(filters: MarketOrderFilterInput) {
    const orders = await listMarketOrders(this.prisma, filters);

    return orders.map((order) => ({
      id: order.id,
      companyId: order.companyId,
      itemId: order.itemId,
      side: order.side,
      status: order.status,
      quantity: order.quantity,
      remainingQuantity: order.remainingQuantity,
      unitPriceCents: order.unitPriceCents.toString(),
      reservedCashCents: order.reservedCashCents.toString(),
      reservedQuantity: order.reservedQuantity,
      tickPlaced: order.tickPlaced,
      tickClosed: order.tickClosed,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    }));
  }
}

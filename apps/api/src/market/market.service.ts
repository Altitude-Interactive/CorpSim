import { Inject, Injectable } from "@nestjs/common";
import { listMarketOrders } from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

export interface MarketOrderFilterInput {
  itemId?: string;
  side?: "BUY" | "SELL";
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
      ...order,
      unitPriceCents: order.unitPriceCents.toString(),
      reservedCashCents: order.reservedCashCents.toString()
    }));
  }
}

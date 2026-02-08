import { Inject, Injectable } from "@nestjs/common";
import {
  cancelMarketOrder,
  listMarketTrades,
  listMarketOrders,
  placeMarketOrder
} from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

export interface MarketOrderFilterInput {
  itemId?: string;
  side?: "BUY" | "SELL";
  companyId?: string;
  limit?: number;
}

export interface PlaceOrderInput {
  companyId: string;
  itemId: string;
  side: "BUY" | "SELL";
  priceCents: number;
  quantity: number;
}

export interface MarketTradeFilterInput {
  itemId?: string;
  companyId?: string;
  limit?: number;
}

interface OrderLike {
  id: string;
  companyId: string;
  itemId: string;
  side: "BUY" | "SELL";
  status: string;
  quantity: number;
  remainingQuantity: number;
  unitPriceCents: bigint;
  reservedCashCents: bigint;
  reservedQuantity: number;
  tickPlaced: number;
  tickClosed: number | null;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

interface TradeLike {
  id: string;
  tick: number;
  itemId: string;
  buyerCompanyId: string;
  sellerCompanyId: string;
  unitPriceCents: bigint;
  quantity: number;
  createdAt: Date;
}

function mapOrderToDto(order: OrderLike) {
  return {
    id: order.id,
    companyId: order.companyId,
    itemId: order.itemId,
    side: order.side,
    status: order.status,
    quantity: order.quantity,
    remainingQuantity: order.remainingQuantity,
    priceCents: order.unitPriceCents.toString(),
    reservedCashCents: order.reservedCashCents.toString(),
    reservedQuantity: order.reservedQuantity,
    tickPlaced: order.tickPlaced,
    tickClosed: order.tickClosed,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    closedAt: order.closedAt
  };
}

function mapTradeToDto(trade: TradeLike) {
  return {
    id: trade.id,
    tick: trade.tick,
    itemId: trade.itemId,
    buyerId: trade.buyerCompanyId,
    sellerId: trade.sellerCompanyId,
    priceCents: trade.unitPriceCents.toString(),
    quantity: trade.quantity,
    createdAt: trade.createdAt
  };
}

@Injectable()
export class MarketService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listOrders(filters: MarketOrderFilterInput) {
    const orders = await listMarketOrders(this.prisma, filters);
    return orders.map(mapOrderToDto);
  }

  async placeOrder(input: PlaceOrderInput) {
    const order = await placeMarketOrder(this.prisma, {
      companyId: input.companyId,
      itemId: input.itemId,
      side: input.side,
      quantity: input.quantity,
      unitPriceCents: BigInt(input.priceCents)
    });

    return mapOrderToDto(order);
  }

  async cancelOrder(orderId: string) {
    const order = await cancelMarketOrder(this.prisma, { orderId });
    return mapOrderToDto(order);
  }

  async listTrades(filters: MarketTradeFilterInput) {
    const trades = await listMarketTrades(this.prisma, filters);
    return trades.map(mapTradeToDto);
  }
}

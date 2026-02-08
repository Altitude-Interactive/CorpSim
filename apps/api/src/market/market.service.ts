import { Inject, Injectable } from "@nestjs/common";
import {
  assertCompanyOwnedByPlayer,
  getMarketAnalyticsSummary,
  assertOrderOwnedByPlayer,
  cancelMarketOrder,
  listMarketCandles,
  listMarketTrades,
  listMarketOrders,
  placeMarketOrder,
  resolvePlayerByHandle
} from "../../../../packages/sim/src";
import { PrismaService } from "../prisma/prisma.service";

export interface MarketOrderFilterInput {
  itemId?: string;
  regionId?: string;
  side?: "BUY" | "SELL";
  companyId?: string;
  limit?: number;
}

export interface PlaceOrderInput {
  companyId: string;
  itemId: string;
  regionId?: string;
  side: "BUY" | "SELL";
  priceCents: number;
  quantity: number;
}

export interface MarketTradeFilterInput {
  itemId?: string;
  regionId?: string;
  companyId?: string;
  limit?: number;
}

export interface MarketCandleFilterInput {
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

interface OrderLike {
  id: string;
  companyId: string;
  itemId: string;
  regionId: string;
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
  regionId: string;
  buyerCompanyId: string;
  sellerCompanyId: string;
  unitPriceCents: bigint;
  quantity: number;
  createdAt: Date;
}

interface CandleLike {
  id: string;
  itemId: string;
  regionId: string;
  tick: number;
  openCents: bigint;
  highCents: bigint;
  lowCents: bigint;
  closeCents: bigint;
  volumeQty: number;
  tradeCount: number;
  vwapCents: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapOrderToDto(order: OrderLike) {
  return {
    id: order.id,
    companyId: order.companyId,
    itemId: order.itemId,
    regionId: order.regionId,
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
    regionId: trade.regionId,
    buyerId: trade.buyerCompanyId,
    sellerId: trade.sellerCompanyId,
    priceCents: trade.unitPriceCents.toString(),
    quantity: trade.quantity,
    createdAt: trade.createdAt
  };
}

function mapCandleToDto(candle: CandleLike) {
  return {
    id: candle.id,
    itemId: candle.itemId,
    regionId: candle.regionId,
    tick: candle.tick,
    openCents: candle.openCents.toString(),
    highCents: candle.highCents.toString(),
    lowCents: candle.lowCents.toString(),
    closeCents: candle.closeCents.toString(),
    volumeQty: candle.volumeQty,
    tradeCount: candle.tradeCount,
    vwapCents: candle.vwapCents === null ? null : candle.vwapCents.toString(),
    createdAt: candle.createdAt,
    updatedAt: candle.updatedAt
  };
}

@Injectable()
export class MarketService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listOrders(filters: MarketOrderFilterInput, playerHandle: string) {
    if (filters.companyId) {
      const player = await resolvePlayerByHandle(this.prisma, playerHandle);
      await assertCompanyOwnedByPlayer(this.prisma, player.id, filters.companyId);
    }

    const orders = await listMarketOrders(this.prisma, filters);
    return orders.map(mapOrderToDto);
  }

  async placeOrder(input: PlaceOrderInput, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertCompanyOwnedByPlayer(this.prisma, player.id, input.companyId);

    const order = await placeMarketOrder(this.prisma, {
      companyId: input.companyId,
      itemId: input.itemId,
      regionId: input.regionId,
      side: input.side,
      quantity: input.quantity,
      unitPriceCents: BigInt(input.priceCents)
    });

    return mapOrderToDto(order);
  }

  async cancelOrder(orderId: string, playerHandle: string) {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertOrderOwnedByPlayer(this.prisma, player.id, orderId);

    const order = await cancelMarketOrder(this.prisma, { orderId });
    return mapOrderToDto(order);
  }

  async listTrades(filters: MarketTradeFilterInput) {
    const trades = await listMarketTrades(this.prisma, filters);
    return trades.map(mapTradeToDto);
  }

  async listCandles(filters: MarketCandleFilterInput) {
    const candles = await listMarketCandles(this.prisma, filters);
    return candles.map(mapCandleToDto);
  }

  async getAnalyticsSummary(input: MarketAnalyticsSummaryInput) {
    const summary = await getMarketAnalyticsSummary(this.prisma, input);

    return {
      itemId: summary.itemId,
      regionId: summary.regionId,
      fromTick: summary.fromTick,
      toTick: summary.toTick,
      candleCount: summary.candleCount,
      lastPriceCents: summary.lastPriceCents === null ? null : summary.lastPriceCents.toString(),
      changePctBps: summary.changePctBps,
      highCents: summary.highCents === null ? null : summary.highCents.toString(),
      lowCents: summary.lowCents === null ? null : summary.lowCents.toString(),
      avgVolumeQty: summary.avgVolumeQty,
      totalVolumeQty: summary.totalVolumeQty,
      vwapCents: summary.vwapCents === null ? null : summary.vwapCents.toString()
    };
  }
}

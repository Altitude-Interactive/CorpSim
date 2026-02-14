import { Inject, Injectable } from "@nestjs/common";
import type {
  MarketAnalyticsSummary,
  MarketCandle,
  MarketCandleFilters,
  MarketOrder,
  MarketOrderFilters,
  MarketTrade,
  MarketTradeFilters,
  PlaceMarketOrderInput
} from "@corpsim/shared";
import { OrderStatus } from "@prisma/client";
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
} from "@corpsim/sim";
import { PrismaService } from "../prisma/prisma.service";

interface OrderLike {
  id: string;
  companyId: string;
  itemId: string;
  regionId: string;
  side: "BUY" | "SELL";
  status: OrderStatus;
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

function mapOrderToDto(order: OrderLike): MarketOrder {
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
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    closedAt: order.closedAt?.toISOString() ?? null
  };
}

function mapTradeToDto(trade: TradeLike): MarketTrade {
  return {
    id: trade.id,
    tick: trade.tick,
    itemId: trade.itemId,
    regionId: trade.regionId,
    buyerId: trade.buyerCompanyId,
    sellerId: trade.sellerCompanyId,
    priceCents: trade.unitPriceCents.toString(),
    quantity: trade.quantity,
    createdAt: trade.createdAt.toISOString()
  };
}

function mapCandleToDto(candle: CandleLike): MarketCandle {
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
    createdAt: candle.createdAt.toISOString(),
    updatedAt: candle.updatedAt.toISOString()
  };
}

@Injectable()
export class MarketService {
  private readonly prisma: PrismaService;

  constructor(@Inject(PrismaService) prisma: PrismaService) {
    this.prisma = prisma;
  }

  async listOrders(filters: MarketOrderFilters, playerHandle: string): Promise<MarketOrder[]> {
    if (filters.companyId) {
      const player = await resolvePlayerByHandle(this.prisma, playerHandle);
      await assertCompanyOwnedByPlayer(this.prisma, player.id, filters.companyId);
    }

    const orders = await listMarketOrders(this.prisma, filters);
    return orders.map(mapOrderToDto);
  }

  async placeOrder(input: PlaceMarketOrderInput, playerHandle: string): Promise<MarketOrder> {
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

  async cancelOrder(orderId: string, playerHandle: string): Promise<MarketOrder> {
    const player = await resolvePlayerByHandle(this.prisma, playerHandle);
    await assertOrderOwnedByPlayer(this.prisma, player.id, orderId);

    const order = await cancelMarketOrder(this.prisma, { orderId });
    return mapOrderToDto(order);
  }

  async listTrades(filters: MarketTradeFilters): Promise<MarketTrade[]> {
    const trades = await listMarketTrades(this.prisma, filters);
    return trades.map(mapTradeToDto);
  }

  async listCandles(filters: MarketCandleFilters): Promise<MarketCandle[]> {
    const candles = await listMarketCandles(this.prisma, filters);
    return candles.map(mapCandleToDto);
  }

  async getAnalyticsSummary(
    input: { itemId: string; regionId: string; windowTicks?: number }
  ): Promise<MarketAnalyticsSummary> {
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


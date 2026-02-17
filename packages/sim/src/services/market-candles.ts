/**
 * Market Candles Service - OHLCV Aggregation
 *
 * @module market-candles
 *
 * ## Purpose
 * Aggregates trades into OHLC (Open, High, Low, Close) candlesticks with volume and VWAP.
 * Provides historical price data for charting and analytics.
 *
 * ## Key Operations
 * - **computeTickCandlesFromTrades**: Groups trades by item+region, sorts by time, computes
 *   open/high/low/close prices, volume, trade count, VWAP (with rounding)
 * - **upsertMarketCandlesForTick**: Fetches trades for tick, computes candles, upserts into database
 *
 * ## Candle Computation
 * - **Open**: First trade price in the tick
 * - **High**: Highest trade price in the tick
 * - **Low**: Lowest trade price in the tick
 * - **Close**: Last trade price in the tick
 * - **Volume**: Sum of all trade quantities
 * - **Trade Count**: Number of trades
 * - **VWAP**: Volume-weighted average price = sum(price × quantity) / sum(quantity)
 *
 * ## Invariants
 * - Trade must have itemId, regionId, positive price (cents), positive quantity
 * - Tick must be non-negative integer
 * - Candle volume must be positive integer
 * - Trades sorted by createdAt for deterministic open/close
 *
 * ## Determinism
 * - Trades sorted by timestamp + id (deterministic ordering)
 * - VWAP calculation uses integer arithmetic (no floating point)
 * - Same trades → same candles (reproducible)
 *
 * ## Usage
 * - Historical price charts
 * - Market analytics and reporting
 * - Price discovery indicators
 * - Trading strategy backtesting
 */
import { Prisma } from "@prisma/client";
import { DomainInvariantError } from "../domain/errors";

export interface CandleTradeRow {
  id: string;
  itemId: string;
  regionId: string;
  unitPriceCents: bigint;
  quantity: number;
  createdAt: Date;
}

export interface ComputedItemTickCandle {
  itemId: string;
  regionId: string;
  tick: number;
  openCents: bigint;
  highCents: bigint;
  lowCents: bigint;
  closeCents: bigint;
  volumeQty: number;
  tradeCount: number;
  vwapCents: bigint;
}

function compareTradesByTime(left: CandleTradeRow, right: CandleTradeRow): number {
  const delta = left.createdAt.getTime() - right.createdAt.getTime();
  if (delta !== 0) {
    return delta;
  }
  return left.id.localeCompare(right.id);
}

function validateTick(tick: number): void {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new DomainInvariantError("tick must be a non-negative integer");
  }
}

function validateTradeRow(trade: CandleTradeRow): void {
  if (!trade.itemId) {
    throw new DomainInvariantError("trade itemId is required");
  }
  if (!trade.regionId) {
    throw new DomainInvariantError("trade regionId is required");
  }
  if (trade.unitPriceCents <= 0n) {
    throw new DomainInvariantError("trade unitPriceCents must be positive");
  }
  if (!Number.isInteger(trade.quantity) || trade.quantity <= 0) {
    throw new DomainInvariantError("trade quantity must be a positive integer");
  }
}

export function computeTickCandlesFromTrades(
  tick: number,
  trades: CandleTradeRow[]
): ComputedItemTickCandle[] {
  validateTick(tick);

  if (trades.length === 0) {
    return [];
  }

  const grouped = new Map<string, CandleTradeRow[]>();
  for (const trade of trades) {
    validateTradeRow(trade);
    const key = `${trade.regionId}:${trade.itemId}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(trade);
    grouped.set(key, bucket);
  }

  const candles: ComputedItemTickCandle[] = [];
  const sortedKeys = [...grouped.keys()].sort((left, right) => left.localeCompare(right));

  for (const key of sortedKeys) {
    const itemTrades = [...(grouped.get(key) ?? [])].sort(compareTradesByTime);
    const first = itemTrades[0];
    const last = itemTrades[itemTrades.length - 1];

    if (!first || !last) {
      continue;
    }

    let high = first.unitPriceCents;
    let low = first.unitPriceCents;
    let volume = 0;
    let notional = 0n;

    for (const trade of itemTrades) {
      if (trade.unitPriceCents > high) {
        high = trade.unitPriceCents;
      }
      if (trade.unitPriceCents < low) {
        low = trade.unitPriceCents;
      }
      volume += trade.quantity;
      notional += trade.unitPriceCents * BigInt(trade.quantity);
    }

    if (!Number.isInteger(volume) || volume <= 0) {
      throw new DomainInvariantError("candle volume must be a positive integer");
    }

    const vwap = (notional + BigInt(Math.floor(volume / 2))) / BigInt(volume);
    candles.push({
      itemId: first.itemId,
      regionId: first.regionId,
      tick,
      openCents: first.unitPriceCents,
      highCents: high,
      lowCents: low,
      closeCents: last.unitPriceCents,
      volumeQty: volume,
      tradeCount: itemTrades.length,
      vwapCents: vwap
    });
  }

  return candles;
}

export async function upsertMarketCandlesForTick(
  tx: Prisma.TransactionClient,
  tick: number
): Promise<void> {
  validateTick(tick);

  const trades = await tx.trade.findMany({
    where: { tick },
    select: {
      id: true,
      itemId: true,
      regionId: true,
      unitPriceCents: true,
      quantity: true,
      createdAt: true
    }
  });

  const candles = computeTickCandlesFromTrades(tick, trades);
  for (const candle of candles) {
    await tx.itemTickCandle.upsert({
      where: {
        itemId_regionId_tick: {
          itemId: candle.itemId,
          regionId: candle.regionId,
          tick: candle.tick
        }
      },
      create: {
        itemId: candle.itemId,
        regionId: candle.regionId,
        tick: candle.tick,
        openCents: candle.openCents,
        highCents: candle.highCents,
        lowCents: candle.lowCents,
        closeCents: candle.closeCents,
        volumeQty: candle.volumeQty,
        tradeCount: candle.tradeCount,
        vwapCents: candle.vwapCents
      },
      update: {
        openCents: candle.openCents,
        highCents: candle.highCents,
        lowCents: candle.lowCents,
        closeCents: candle.closeCents,
        volumeQty: candle.volumeQty,
        tradeCount: candle.tradeCount,
        vwapCents: candle.vwapCents
      }
    });
  }
}

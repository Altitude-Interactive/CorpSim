import { OrderSide } from "@prisma/client";

export interface LiquidityItemState {
  itemId: string;
  itemCode: string;
  referencePriceCents: bigint;
  availableInventory: number;
  hasOpenBuyOrder: boolean;
  hasOpenSellOrder: boolean;
  bestOwnBuyPriceCents?: bigint | null;
  bestOwnSellPriceCents?: bigint | null;
  bestExternalBuyPriceCents?: bigint | null;
  bestExternalSellPriceCents?: bigint | null;
}

export interface LiquidityBotState {
  availableCashCents: bigint;
  availableStorageUnits?: number | null;
  items: LiquidityItemState[];
}

export interface LiquidityBotConfig {
  spreadBps: number;
  maxNotionalPerTickCents: bigint;
  targetQuantityPerSide: number;
}

export interface PlannedLiquidityOrder {
  itemId: string;
  side: OrderSide;
  quantity: number;
  unitPriceCents: bigint;
}

const AGGRESSIVE_CROSS_QUANTITY = 1;

function calculateBuyPrice(referencePriceCents: bigint, spreadBps: number): bigint {
  const price = (referencePriceCents * BigInt(10_000 - spreadBps)) / 10_000n;
  return price > 0n ? price : 1n;
}

function calculateSellPrice(referencePriceCents: bigint, spreadBps: number): bigint {
  const price = (referencePriceCents * BigInt(10_000 + spreadBps)) / 10_000n;
  return price > 0n ? price : 1n;
}

function capByNotional(maxNotionalCents: bigint, unitPriceCents: bigint, desired: number): number {
  if (unitPriceCents <= 0n) {
    return 0;
  }

  const maxUnits = Number(maxNotionalCents / unitPriceCents);
  return Math.max(0, Math.min(desired, maxUnits));
}

export function planLiquidityOrders(
  state: LiquidityBotState,
  config: LiquidityBotConfig
): PlannedLiquidityOrder[] {
  if (config.maxNotionalPerTickCents <= 0n || config.targetQuantityPerSide <= 0) {
    return [];
  }

  const orders: PlannedLiquidityOrder[] = [];
  let remainingBuyNotional = config.maxNotionalPerTickCents;
  let remainingSellNotional = config.maxNotionalPerTickCents;
  let remainingCash = state.availableCashCents;
  let remainingStorageUnits =
    Number.isInteger(state.availableStorageUnits) && (state.availableStorageUnits ?? 0) >= 0
      ? (state.availableStorageUnits as number)
      : Number.POSITIVE_INFINITY;

  const sortedItems = [...state.items].sort((left, right) => left.itemCode.localeCompare(right.itemCode));

  for (const item of sortedItems) {
    if (remainingBuyNotional <= 0n && remainingSellNotional <= 0n) {
      break;
    }

    const buyPrice = calculateBuyPrice(item.referencePriceCents, config.spreadBps);
    const sellPrice = calculateSellPrice(item.referencePriceCents, config.spreadBps);
    let placedBuyThisItem = false;
    let placedSellThisItem = false;
    let placedCrossingBuyThisItem = false;

    if (remainingSellNotional > 0n && !item.hasOpenSellOrder) {
      const desired = Math.min(config.targetQuantityPerSide, item.availableInventory);
      const quantity = capByNotional(remainingSellNotional, sellPrice, desired);

      if (quantity > 0) {
        const notional = BigInt(quantity) * sellPrice;
        orders.push({
          itemId: item.itemId,
          side: OrderSide.SELL,
          quantity,
          unitPriceCents: sellPrice
        });
        remainingSellNotional -= notional;
        placedSellThisItem = true;
      }
    }

    if (!item.hasOpenBuyOrder) {
      const maxByBudget = buyPrice > 0n ? Number(remainingCash / buyPrice) : 0;
      const desired = Math.min(config.targetQuantityPerSide, maxByBudget);
      const quantity = capByNotional(remainingBuyNotional, buyPrice, desired);

      if (quantity > 0) {
        const notional = BigInt(quantity) * buyPrice;
        orders.push({
          itemId: item.itemId,
          side: OrderSide.BUY,
          quantity,
          unitPriceCents: buyPrice
        });
        remainingBuyNotional -= notional;
        remainingCash -= notional;
        placedBuyThisItem = true;
      }
    }

    // If only one side is currently open for this bot on this item, place a small
    // deterministic taker order against external liquidity to unblock trade flow.
    if (
      remainingBuyNotional > 0n &&
      !placedBuyThisItem &&
      item.bestExternalSellPriceCents !== null &&
      item.bestExternalSellPriceCents !== undefined &&
      (
        item.bestOwnSellPriceCents === null ||
        item.bestOwnSellPriceCents === undefined ||
        item.bestOwnSellPriceCents > item.bestExternalSellPriceCents
      )
    ) {
      const crossBuyPrice = item.bestExternalSellPriceCents;
      const maxByBudget = crossBuyPrice > 0n ? Number(remainingCash / crossBuyPrice) : 0;
      const desired = Math.min(AGGRESSIVE_CROSS_QUANTITY, maxByBudget, remainingStorageUnits);
      const quantity = capByNotional(remainingBuyNotional, crossBuyPrice, desired);

      if (quantity > 0) {
        const notional = BigInt(quantity) * crossBuyPrice;
        orders.push({
          itemId: item.itemId,
          side: OrderSide.BUY,
          quantity,
          unitPriceCents: crossBuyPrice
        });
        remainingBuyNotional -= notional;
        remainingCash -= notional;
        remainingStorageUnits = Math.max(0, remainingStorageUnits - quantity);
        placedBuyThisItem = true;
        placedCrossingBuyThisItem = true;
      }
    }

    if (
      remainingSellNotional > 0n &&
      !placedSellThisItem &&
      item.bestExternalBuyPriceCents !== null &&
      item.bestExternalBuyPriceCents !== undefined &&
      (
        item.bestOwnBuyPriceCents === null ||
        item.bestOwnBuyPriceCents === undefined ||
        item.bestOwnBuyPriceCents < item.bestExternalBuyPriceCents
      )
    ) {
      const crossSellPrice = item.bestExternalBuyPriceCents;
      const desired = Math.min(AGGRESSIVE_CROSS_QUANTITY, item.availableInventory);
      const quantity = capByNotional(remainingSellNotional, crossSellPrice, desired);

      if (quantity > 0) {
        const notional = BigInt(quantity) * crossSellPrice;
        orders.push({
          itemId: item.itemId,
          side: OrderSide.SELL,
          quantity,
          unitPriceCents: crossSellPrice
        });
        remainingSellNotional -= notional;
      }
    }

    // Fallback: if no safe external crossing buy is available, allow a tiny self-cross
    // against this bot's resting sell liquidity to keep trade tape active.
    if (!placedCrossingBuyThisItem && remainingBuyNotional > 0n) {
      const ownSellPriceForSelfCross =
        item.bestOwnSellPriceCents ?? (placedSellThisItem ? sellPrice : null);

      if (ownSellPriceForSelfCross !== null && ownSellPriceForSelfCross !== undefined) {
        const maxByBudget =
          ownSellPriceForSelfCross > 0n ? Number(remainingCash / ownSellPriceForSelfCross) : 0;
        const desired = Math.min(AGGRESSIVE_CROSS_QUANTITY, maxByBudget);
        const quantity = capByNotional(remainingBuyNotional, ownSellPriceForSelfCross, desired);

        if (quantity > 0) {
          const notional = BigInt(quantity) * ownSellPriceForSelfCross;
          orders.push({
            itemId: item.itemId,
            side: OrderSide.BUY,
            quantity,
            unitPriceCents: ownSellPriceForSelfCross
          });
          remainingBuyNotional -= notional;
          remainingCash -= notional;
        }
      }
    }
  }

  return orders;
}

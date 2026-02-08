import { OrderSide } from "@prisma/client";

export interface LiquidityItemState {
  itemId: string;
  itemCode: string;
  referencePriceCents: bigint;
  availableInventory: number;
  hasOpenBuyOrder: boolean;
  hasOpenSellOrder: boolean;
}

export interface LiquidityBotState {
  availableCashCents: bigint;
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
  let remainingNotional = config.maxNotionalPerTickCents;
  let remainingCash = state.availableCashCents;

  const sortedItems = [...state.items].sort((left, right) => left.itemCode.localeCompare(right.itemCode));

  for (const item of sortedItems) {
    if (remainingNotional <= 0n) {
      break;
    }

    const buyPrice = calculateBuyPrice(item.referencePriceCents, config.spreadBps);
    const sellPrice = calculateSellPrice(item.referencePriceCents, config.spreadBps);

    if (!item.hasOpenBuyOrder) {
      const maxByBudget = buyPrice > 0n ? Number(remainingCash / buyPrice) : 0;
      const desired = Math.min(config.targetQuantityPerSide, maxByBudget);
      const quantity = capByNotional(remainingNotional, buyPrice, desired);

      if (quantity > 0) {
        const notional = BigInt(quantity) * buyPrice;
        orders.push({
          itemId: item.itemId,
          side: OrderSide.BUY,
          quantity,
          unitPriceCents: buyPrice
        });
        remainingNotional -= notional;
        remainingCash -= notional;
      }
    }

    if (remainingNotional <= 0n || item.hasOpenSellOrder) {
      continue;
    }

    const desired = Math.min(config.targetQuantityPerSide, item.availableInventory);
    const quantity = capByNotional(remainingNotional, sellPrice, desired);

    if (quantity > 0) {
      const notional = BigInt(quantity) * sellPrice;
      orders.push({
        itemId: item.itemId,
        side: OrderSide.SELL,
        quantity,
        unitPriceCents: sellPrice
      });
      remainingNotional -= notional;
    }
  }

  return orders;
}

/**
 * Market Matching and Settlement Service
 *
 * @module market-matching
 *
 * ## Purpose
 * Executes deterministic order matching and settlement for market trading.
 * Matches buy and sell orders within the same region/item pair, executes trades
 * at calculated prices, and atomically transfers inventory and cash between companies
 * while maintaining strict ledger records.
 *
 * ## Matching Algorithm
 * - **Price-time priority**: Buy orders sorted by highest price first, then timestamp/ID;
 *   sell orders by lowest price first, then timestamp/ID
 * - **Execution Price**: "Resting order" rule - uses the older order's price (by tickPlaced, createdAt, id)
 * - **Matching Condition**: Buy price ≥ Sell price; quantity limited to min(buyRemaining, sellRemaining)
 * - **Regional Constraint**: Only matches orders in the same region; cross-region trades are skipped
 *
 * ## Invariants Enforced
 * ### Pre-settlement checks:
 * - Both orders remain OPEN and exist
 * - Order sides are correct (buy/sell), items/regions match
 * - Matched quantity ≤ remaining quantities on both orders
 * - Buyer has reserved cash ≥ order price × quantity
 * - Seller has reserved quantity ≥ matched quantity and actual inventory
 * - Buyer company has total cash ≥ trade notional
 *
 * ### Post-settlement invariants:
 * - reservedCash ≥ 0
 * - cash ≥ 0
 * - reservedCash ≤ cash
 *
 * ## Side Effects
 * All settlement occurs within a single Prisma transaction (atomic):
 * - Updates: 2 company cash records, 1-2 inventory records (seller decrease, buyer upsert)
 * - Updates: 2 market order records (reduce remaining quantities)
 * - Creates: 1 trade record + 2 ledger entries (buy/sell settlement)
 * - **Self-trade handling**: If buyer == seller, net cash cancels; reserved reduction still applied
 *
 * ## Transaction Boundaries
 * - Each settlement is a separate transaction
 * - No partial settlements (all-or-nothing)
 * - Rollback on any validation failure or constraint violation
 *
 * ## Determinism
 * - Fixed sort order ensures reproducible matching
 * - Same market state + tick → identical trade sequence
 * - No randomness or non-deterministic behavior
 *
 * ## Error Handling
 * - DomainInvariantError: Structural violations (order mismatch, negative balances, inventory shortage)
 * - NotFoundError: Orders or companies deleted concurrently
 * - Early return: If either order already filled (non-OPEN status), skip settlement silently (idempotent)
 * - No explicit retry logic; failures propagate to transaction rollback
 */
import {
  LedgerEntryType,
  OrderSide,
  OrderStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { DomainInvariantError, NotFoundError } from "../domain/errors";
import { validateStorageCapacity } from "./buildings";

/**
 * Order representation for matching purposes.
 */
export interface MatchableOrder {
  id: string;
  itemId: string;
  regionId: string;
  companyId: string;
  side: OrderSide;
  unitPriceCents: bigint;
  remainingQuantity: number;
  tickPlaced: number;
  createdAt: Date;
}

/**
 * Planned match between a buy and sell order.
 */
export interface MatchPlan {
  itemId: string;
  regionId: string;
  buyOrderId: string;
  sellOrderId: string;
  quantity: number;
  unitPriceCents: bigint;
}

/**
 * Compares orders by time priority (tickPlaced, then createdAt, then id).
 * Used for price-time priority matching (when prices are equal).
 */
function compareByTimeThenId(
  left: Pick<MatchableOrder, "tickPlaced" | "createdAt" | "id">,
  right: Pick<MatchableOrder, "tickPlaced" | "createdAt" | "id">
): number {
  if (left.tickPlaced !== right.tickPlaced) {
    return left.tickPlaced - right.tickPlaced;
  }

  const timeDelta = left.createdAt.getTime() - right.createdAt.getTime();
  if (timeDelta !== 0) {
    return timeDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareBuyPriority(left: MatchableOrder, right: MatchableOrder): number {
  if (left.unitPriceCents !== right.unitPriceCents) {
    return left.unitPriceCents > right.unitPriceCents ? -1 : 1;
  }

  return compareByTimeThenId(left, right);
}

function compareSellPriority(left: MatchableOrder, right: MatchableOrder): number {
  if (left.unitPriceCents !== right.unitPriceCents) {
    return left.unitPriceCents < right.unitPriceCents ? -1 : 1;
  }

  return compareByTimeThenId(left, right);
}

function resolveExecutionPrice(buy: MatchableOrder, sell: MatchableOrder): bigint {
  // Price rule: use resting order price (older order by tickPlaced, createdAt, id).
  return compareByTimeThenId(buy, sell) <= 0 ? buy.unitPriceCents : sell.unitPriceCents;
}

export function planOrderMatchesForItem(
  buys: MatchableOrder[],
  sells: MatchableOrder[]
): MatchPlan[] {
  const buyRegionId = buys[0]?.regionId ?? null;
  const sellRegionId = sells[0]?.regionId ?? null;
  if (buyRegionId && buys.some((order) => order.regionId !== buyRegionId)) {
    throw new DomainInvariantError("buy orders must share the same region");
  }
  if (sellRegionId && sells.some((order) => order.regionId !== sellRegionId)) {
    throw new DomainInvariantError("sell orders must share the same region");
  }
  if (buyRegionId && sellRegionId && buyRegionId !== sellRegionId) {
    return [];
  }

  const orderedBuys = [...buys]
    .filter((order) => order.side === OrderSide.BUY && order.remainingQuantity > 0)
    .sort(compareBuyPriority)
    .map((order) => ({ ...order }));
  const orderedSells = [...sells]
    .filter((order) => order.side === OrderSide.SELL && order.remainingQuantity > 0)
    .sort(compareSellPriority)
    .map((order) => ({ ...order }));

  const matches: MatchPlan[] = [];
  let buyIndex = 0;
  let sellIndex = 0;

  while (buyIndex < orderedBuys.length && sellIndex < orderedSells.length) {
    const buy = orderedBuys[buyIndex];
    const sell = orderedSells[sellIndex];

    if (buy.unitPriceCents < sell.unitPriceCents) {
      break;
    }

    const quantity = Math.min(buy.remainingQuantity, sell.remainingQuantity);
    const unitPriceCents = resolveExecutionPrice(buy, sell);

    matches.push({
      itemId: buy.itemId,
      regionId: buy.regionId,
      buyOrderId: buy.id,
      sellOrderId: sell.id,
      quantity,
      unitPriceCents
    });

    buy.remainingQuantity -= quantity;
    sell.remainingQuantity -= quantity;

    if (buy.remainingQuantity === 0) {
      buyIndex += 1;
    }

    if (sell.remainingQuantity === 0) {
      sellIndex += 1;
    }
  }

  return matches;
}

async function settleMatch(
  tx: Prisma.TransactionClient,
  match: MatchPlan,
  tick: number
): Promise<void> {
  const [buyOrder, sellOrder] = await Promise.all([
    tx.marketOrder.findUnique({ where: { id: match.buyOrderId } }),
    tx.marketOrder.findUnique({ where: { id: match.sellOrderId } })
  ]);

  if (!buyOrder || !sellOrder) {
    throw new NotFoundError("matched order no longer exists");
  }

  if (buyOrder.status !== OrderStatus.OPEN || sellOrder.status !== OrderStatus.OPEN) {
    return;
  }

  if (buyOrder.side !== OrderSide.BUY || sellOrder.side !== OrderSide.SELL) {
    throw new DomainInvariantError("invalid order side for matched pair");
  }

  if (buyOrder.itemId !== sellOrder.itemId || buyOrder.itemId !== match.itemId) {
    throw new DomainInvariantError("matched orders must share same item");
  }
  if (buyOrder.regionId !== sellOrder.regionId || buyOrder.regionId !== match.regionId) {
    throw new DomainInvariantError("matched orders must share same region");
  }

  if (buyOrder.remainingQuantity < match.quantity || sellOrder.remainingQuantity < match.quantity) {
    throw new DomainInvariantError("matched quantity exceeds order remaining quantity");
  }

  const reserveReduction = BigInt(match.quantity) * buyOrder.unitPriceCents;
  const tradeNotional = BigInt(match.quantity) * match.unitPriceCents;

  if (buyOrder.reservedCashCents < reserveReduction) {
    throw new DomainInvariantError("buy order reserved cash cannot become negative");
  }

  if (sellOrder.reservedQuantity < match.quantity) {
    throw new DomainInvariantError("sell order reserved quantity cannot become negative");
  }

  const [buyerCompany, sellerCompany] = await Promise.all([
    tx.company.findUnique({
      where: { id: buyOrder.companyId },
      select: { id: true, cashCents: true, reservedCashCents: true }
    }),
    tx.company.findUnique({
      where: { id: sellOrder.companyId },
      select: { id: true, cashCents: true, reservedCashCents: true }
    })
  ]);

  if (!buyerCompany || !sellerCompany) {
    throw new NotFoundError("matched company no longer exists");
  }

  const sellerInventory = await tx.inventory.findUnique({
    where: {
      companyId_itemId_regionId: {
        companyId: sellOrder.companyId,
        itemId: sellOrder.itemId,
        regionId: sellOrder.regionId
      }
    },
    select: {
      companyId: true,
      itemId: true,
      regionId: true,
      quantity: true,
      reservedQuantity: true
    }
  });

  if (!sellerInventory) {
    throw new DomainInvariantError("seller inventory row not found");
  }

  if (sellerInventory.quantity < match.quantity || sellerInventory.reservedQuantity < match.quantity) {
    throw new DomainInvariantError("seller inventory cannot satisfy matched quantity");
  }

  if (buyerCompany.reservedCashCents < reserveReduction || buyerCompany.cashCents < tradeNotional) {
    throw new DomainInvariantError("buyer company cannot satisfy matched cash transfer");
  }

  const buyerNextCash = buyerCompany.cashCents - tradeNotional;
  const buyerNextReservedCash = buyerCompany.reservedCashCents - reserveReduction;
  const sellerNextCash = sellerCompany.cashCents + tradeNotional;
  const buyerIsSeller = buyerCompany.id === sellerCompany.id;

  if (buyerNextReservedCash < 0n || buyerNextCash < 0n || buyerNextReservedCash > buyerNextCash) {
    throw new DomainInvariantError("buyer cash invariants violated during settlement");
  }

  const now = new Date();
  const buyRemaining = buyOrder.remainingQuantity - match.quantity;
  const sellRemaining = sellOrder.remainingQuantity - match.quantity;
  const buyReservedCash = buyOrder.reservedCashCents - reserveReduction;
  const sellReservedQuantity = sellOrder.reservedQuantity - match.quantity;

  // Validate storage capacity BEFORE any inventory mutations
  // Skip validation for self-trades in the same region and item (net inventory change is zero)
  const isSelfTradeInSameRegionAndItem =
    buyOrder.companyId === sellOrder.companyId &&
    buyOrder.regionId === sellOrder.regionId &&
    buyOrder.itemId === sellOrder.itemId;

  if (!isSelfTradeInSameRegionAndItem) {
    await validateStorageCapacity(
      tx,
      buyOrder.companyId,
      buyOrder.regionId,
      match.quantity
    );
  }

  if (buyerIsSeller) {
    await tx.company.update({
      where: { id: buyerCompany.id },
      data: {
        cashCents: buyerCompany.cashCents - tradeNotional + tradeNotional,
        reservedCashCents: buyerNextReservedCash
      }
    });
  } else {
    await Promise.all([
      tx.company.update({
        where: { id: buyerCompany.id },
        data: {
          cashCents: buyerNextCash,
          reservedCashCents: buyerNextReservedCash
        }
      }),
      tx.company.update({
        where: { id: sellerCompany.id },
        data: {
          cashCents: sellerNextCash
        }
      })
    ]);
  }

  await tx.inventory.update({
    where: {
      companyId_itemId_regionId: {
        companyId: sellerInventory.companyId,
        itemId: sellerInventory.itemId,
        regionId: sellerInventory.regionId
      }
    },
    data: {
      quantity: sellerInventory.quantity - match.quantity,
      reservedQuantity: sellerInventory.reservedQuantity - match.quantity
    }
  });

  await tx.inventory.upsert({
    where: {
      companyId_itemId_regionId: {
        companyId: buyOrder.companyId,
        itemId: buyOrder.itemId,
        regionId: buyOrder.regionId
      }
    },
    create: {
      companyId: buyOrder.companyId,
      itemId: buyOrder.itemId,
      regionId: buyOrder.regionId,
      quantity: match.quantity,
      reservedQuantity: 0
    },
    update: {
      quantity: {
        increment: match.quantity
      }
    }
  });

  await Promise.all([
    tx.marketOrder.update({
      where: { id: buyOrder.id },
      data: {
        remainingQuantity: buyRemaining,
        reservedCashCents: buyReservedCash,
        status: buyRemaining === 0 ? OrderStatus.FILLED : OrderStatus.OPEN,
        tickClosed: buyRemaining === 0 ? tick : null,
        closedAt: buyRemaining === 0 ? now : null
      }
    }),
    tx.marketOrder.update({
      where: { id: sellOrder.id },
      data: {
        remainingQuantity: sellRemaining,
        reservedQuantity: sellReservedQuantity,
        status: sellRemaining === 0 ? OrderStatus.FILLED : OrderStatus.OPEN,
        tickClosed: sellRemaining === 0 ? tick : null,
        closedAt: sellRemaining === 0 ? now : null
      }
    })
  ]);

  const trade = await tx.trade.create({
    data: {
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      buyerCompanyId: buyOrder.companyId,
      sellerCompanyId: sellOrder.companyId,
      itemId: buyOrder.itemId,
      regionId: buyOrder.regionId,
      quantity: match.quantity,
      unitPriceCents: match.unitPriceCents,
      totalPriceCents: tradeNotional,
      tick
    }
  });

  await tx.ledgerEntry.createMany({
    data: [
      {
        companyId: buyOrder.companyId,
        tick,
        entryType: LedgerEntryType.TRADE_SETTLEMENT,
        deltaCashCents: -tradeNotional,
        deltaReservedCashCents: -reserveReduction,
        balanceAfterCents: buyerNextCash,
        referenceType: "MARKET_TRADE_BUY",
        referenceId: trade.id
      },
      {
        companyId: sellOrder.companyId,
        tick,
        entryType: LedgerEntryType.TRADE_SETTLEMENT,
        deltaCashCents: tradeNotional,
        deltaReservedCashCents: 0n,
        balanceAfterCents: buyerIsSeller ? buyerCompany.cashCents : sellerNextCash,
        referenceType: "MARKET_TRADE_SELL",
        referenceId: trade.id
      }
    ]
  });
}

export async function runMarketMatchingForTick(
  tx: Prisma.TransactionClient,
  tick: number
): Promise<void> {
  const openOrders = await tx.marketOrder.findMany({
    where: { status: OrderStatus.OPEN },
    select: {
      id: true,
      itemId: true,
      regionId: true,
      companyId: true,
      side: true,
      unitPriceCents: true,
      remainingQuantity: true,
      tickPlaced: true,
      createdAt: true
    }
  });

  const orderGroups = new Map<string, { buys: MatchableOrder[]; sells: MatchableOrder[] }>();

  for (const order of openOrders) {
    const groupKey = `${order.regionId}:${order.itemId}`;
    const group = orderGroups.get(groupKey) ?? { buys: [], sells: [] };
    if (order.side === OrderSide.BUY) {
      group.buys.push(order);
    } else {
      group.sells.push(order);
    }
    orderGroups.set(groupKey, group);
  }

  const sortedGroupKeys = [...orderGroups.keys()].sort((left, right) => left.localeCompare(right));

  for (const groupKey of sortedGroupKeys) {
    const group = orderGroups.get(groupKey);
    if (!group) {
      continue;
    }

    const plans = planOrderMatchesForItem(group.buys, group.sells);
    for (const plan of plans) {
      await settleMatch(tx, plan, tick);
    }
  }
}

export async function runMarketMatchingForCurrentTick(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const world = await tx.worldTickState.findUnique({
      where: { id: 1 },
      select: { currentTick: true }
    });

    const tick = world?.currentTick ?? 0;
    await runMarketMatchingForTick(tx, tick);
  });
}

import {
  LedgerEntryType,
  OrderSide,
  OrderStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";
import { DomainInvariantError, NotFoundError } from "../domain/errors";

export interface MatchableOrder {
  id: string;
  itemId: string;
  companyId: string;
  side: OrderSide;
  unitPriceCents: bigint;
  remainingQuantity: number;
  tickPlaced: number;
  createdAt: Date;
}

export interface MatchPlan {
  itemId: string;
  buyOrderId: string;
  sellOrderId: string;
  quantity: number;
  unitPriceCents: bigint;
}

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

  const [buyerCompany, sellerCompany, sellerInventory] = await Promise.all([
    tx.company.findUnique({
      where: { id: buyOrder.companyId },
      select: { id: true, cashCents: true, reservedCashCents: true }
    }),
    tx.company.findUnique({
      where: { id: sellOrder.companyId },
      select: { id: true, cashCents: true, reservedCashCents: true }
    }),
    tx.inventory.findUnique({
      where: {
        companyId_itemId: {
          companyId: sellOrder.companyId,
          itemId: sellOrder.itemId
        }
      },
      select: {
        companyId: true,
        itemId: true,
        quantity: true,
        reservedQuantity: true
      }
    })
  ]);

  if (!buyerCompany || !sellerCompany) {
    throw new NotFoundError("matched company no longer exists");
  }

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

  if (buyerNextReservedCash < 0n || buyerNextCash < 0n || buyerNextReservedCash > buyerNextCash) {
    throw new DomainInvariantError("buyer cash invariants violated during settlement");
  }

  const now = new Date();
  const buyRemaining = buyOrder.remainingQuantity - match.quantity;
  const sellRemaining = sellOrder.remainingQuantity - match.quantity;
  const buyReservedCash = buyOrder.reservedCashCents - reserveReduction;
  const sellReservedQuantity = sellOrder.reservedQuantity - match.quantity;

  const buyerIsSeller = buyerCompany.id === sellerCompany.id;

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
      companyId_itemId: {
        companyId: sellerInventory.companyId,
        itemId: sellerInventory.itemId
      }
    },
    data: {
      quantity: sellerInventory.quantity - match.quantity,
      reservedQuantity: sellerInventory.reservedQuantity - match.quantity
    }
  });

  await tx.inventory.upsert({
    where: {
      companyId_itemId: {
        companyId: buyOrder.companyId,
        itemId: buyOrder.itemId
      }
    },
    create: {
      companyId: buyOrder.companyId,
      itemId: buyOrder.itemId,
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
        balanceAfterCents: buyerIsSeller ? buyerCompany.cashCents : buyerNextCash,
        referenceType: "MARKET_TRADE_BUY",
        referenceId: trade.id
      },
      {
        companyId: sellOrder.companyId,
        tick,
        entryType: LedgerEntryType.TRADE_SETTLEMENT,
        deltaCashCents: tradeNotional,
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
      companyId: true,
      side: true,
      unitPriceCents: true,
      remainingQuantity: true,
      tickPlaced: true,
      createdAt: true
    }
  });

  const orderGroups = new Map<
    string,
    {
      buys: MatchableOrder[];
      sells: MatchableOrder[];
    }
  >();

  for (const order of openOrders) {
    const group = orderGroups.get(order.itemId) ?? { buys: [], sells: [] };
    if (order.side === OrderSide.BUY) {
      group.buys.push(order);
    } else {
      group.sells.push(order);
    }
    orderGroups.set(order.itemId, group);
  }

  const sortedItemIds = [...orderGroups.keys()].sort((left, right) => left.localeCompare(right));

  for (const itemId of sortedItemIds) {
    const group = orderGroups.get(itemId);
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

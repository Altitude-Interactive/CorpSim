import type {
  CompanyDetails,
  CompanySummary,
  ContractFulfillmentResult,
  ContractRecord,
  ContractStatus,
  FinanceLedgerEntry,
  FinanceLedgerEntryType,
  FinanceSummary,
  InventoryRow,
  InvariantIssue,
  ItemCatalogItem,
  MarketAnalyticsSummary,
  MarketCandle,
  MarketOrder,
  MarketTrade,
  PlayerIdentity,
  ProductionJob,
  ProductionJobStatus,
  ProductionRecipe,
  RegionSummary,
  ResearchJob,
  ResearchNode,
  ResearchNodeStatus,
  ShipmentRecord,
  WorldHealth,
  WorldTickState
} from "@corpsim/shared";
import { isRecord, readArray, readBoolean, readNullableString, readNumber, readString } from "./api-client";

export function parseInvariantIssue(value: unknown): InvariantIssue {
  if (!isRecord(value)) {
    throw new Error("Invalid invariant issue");
  }

  const entityType = readString(value.entityType, "entityType");
  if (entityType !== "company" && entityType !== "inventory") {
    throw new Error("Invalid invariant issue entityType");
  }

  const itemId =
    value.itemId === undefined || value.itemId === null
      ? undefined
      : readString(value.itemId, "itemId");

  return {
    code: readString(value.code, "code"),
    entityType,
    companyId: readString(value.companyId, "companyId"),
    itemId,
    message: readString(value.message, "message")
  };
}

export function parseWorldHealth(value: unknown): WorldHealth {
  if (!isRecord(value)) {
    throw new Error("Invalid world health payload");
  }

  if (!isRecord(value.invariants)) {
    throw new Error("Invalid world health invariants payload");
  }

  return {
    currentTick: readNumber(value.currentTick, "currentTick"),
    lockVersion: readNumber(value.lockVersion, "lockVersion"),
    lastAdvancedAt: readNullableString(value.lastAdvancedAt, "lastAdvancedAt"),
    ordersOpenCount: readNumber(value.ordersOpenCount, "ordersOpenCount"),
    ordersTotalCount: readNumber(value.ordersTotalCount, "ordersTotalCount"),
    tradesLast100Count: readNumber(value.tradesLast100Count, "tradesLast100Count"),
    companiesCount: readNumber(value.companiesCount, "companiesCount"),
    botsCount: readNumber(value.botsCount, "botsCount"),
    sumCashCents: readString(value.sumCashCents, "sumCashCents"),
    sumReservedCashCents: readString(value.sumReservedCashCents, "sumReservedCashCents"),
    invariants: {
      hasViolations: readBoolean(value.invariants.hasViolations, "invariants.hasViolations"),
      truncated: readBoolean(value.invariants.truncated, "invariants.truncated"),
      issues: readArray(value.invariants.issues, "invariants.issues").map(parseInvariantIssue)
    }
  };
}

export function parseWorldTickState(value: unknown): WorldTickState {
  if (!isRecord(value)) {
    throw new Error("Invalid world tick payload");
  }

  return {
    currentTick: readNumber(value.currentTick, "currentTick"),
    lockVersion: readNumber(value.lockVersion, "lockVersion"),
    lastAdvancedAt: readNullableString(value.lastAdvancedAt, "lastAdvancedAt")
  };
}

export function parseCompanySummary(value: unknown): CompanySummary {
  if (!isRecord(value)) {
    throw new Error("Invalid company item");
  }

  return {
    id: readString(value.id, "id"),
    code: readString(value.code, "code"),
    name: readString(value.name, "name"),
    isBot: readBoolean(value.isBot, "isBot"),
    cashCents: readString(value.cashCents, "cashCents"),
    regionId: readString(value.regionId, "regionId"),
    regionCode: readString(value.regionCode, "regionCode"),
    regionName: readString(value.regionName, "regionName")
  };
}

export function parseCompanyDetails(value: unknown): CompanyDetails {
  if (!isRecord(value)) {
    throw new Error("Invalid company payload");
  }

  return {
    id: readString(value.id, "id"),
    code: readString(value.code, "code"),
    name: readString(value.name, "name"),
    isBot: readBoolean(value.isBot, "isBot"),
    cashCents: readString(value.cashCents, "cashCents"),
    reservedCashCents: readString(value.reservedCashCents, "reservedCashCents"),
    regionId: readString(value.regionId, "regionId"),
    regionCode: readString(value.regionCode, "regionCode"),
    regionName: readString(value.regionName, "regionName"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt")
  };
}

export function parsePlayerIdentity(value: unknown): PlayerIdentity {
  if (!isRecord(value)) {
    throw new Error("Invalid player payload");
  }

  return {
    id: readString(value.id, "id"),
    handle: readString(value.handle, "handle"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt")
  };
}

export function parseInventoryRow(value: unknown): InventoryRow {
  if (!isRecord(value)) {
    throw new Error("Invalid inventory item");
  }

  return {
    itemId: readString(value.itemId, "itemId"),
    regionId: readString(value.regionId, "regionId"),
    itemCode: readString(value.itemCode, "itemCode"),
    itemName: readString(value.itemName, "itemName"),
    quantity: readNumber(value.quantity, "quantity"),
    reservedQuantity: readNumber(value.reservedQuantity, "reservedQuantity")
  };
}

export function parseRegionSummary(value: unknown): RegionSummary {
  if (!isRecord(value)) {
    throw new Error("Invalid region row");
  }

  return {
    id: readString(value.id, "id"),
    code: readString(value.code, "code"),
    name: readString(value.name, "name")
  };
}

export function parseShipmentStatus(value: unknown): ShipmentRecord["status"] {
  const status = readString(value, "status");
  if (status !== "IN_TRANSIT" && status !== "DELIVERED" && status !== "CANCELLED") {
    throw new Error("Invalid shipment status");
  }
  return status;
}

export function parseShipmentRecord(value: unknown): ShipmentRecord {
  if (!isRecord(value)) {
    throw new Error("Invalid shipment row");
  }
  if (!isRecord(value.item)) {
    throw new Error("Invalid shipment item");
  }

  return {
    id: readString(value.id, "id"),
    companyId: readString(value.companyId, "companyId"),
    fromRegionId: readString(value.fromRegionId, "fromRegionId"),
    toRegionId: readString(value.toRegionId, "toRegionId"),
    itemId: readString(value.itemId, "itemId"),
    quantity: readNumber(value.quantity, "quantity"),
    status: parseShipmentStatus(value.status),
    tickCreated: readNumber(value.tickCreated, "tickCreated"),
    tickArrives: readNumber(value.tickArrives, "tickArrives"),
    tickClosed:
      value.tickClosed === null ? null : readNumber(value.tickClosed, "tickClosed"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt"),
    item: {
      id: readString(value.item.id, "item.id"),
      code: readString(value.item.code, "item.code"),
      name: readString(value.item.name, "item.name")
    },
    fromRegion: parseRegionSummary(value.fromRegion),
    toRegion: parseRegionSummary(value.toRegion)
  };
}

export function parseMarketOrder(value: unknown): MarketOrder {
  if (!isRecord(value)) {
    throw new Error("Invalid market order");
  }

  const side = readString(value.side, "side");
  if (side !== "BUY" && side !== "SELL") {
    throw new Error("Invalid market order side");
  }

  const tickClosedValue = value.tickClosed;

  return {
    id: readString(value.id, "id"),
    companyId: readString(value.companyId, "companyId"),
    itemId: readString(value.itemId, "itemId"),
    regionId: readString(value.regionId, "regionId"),
    side,
    status: readString(value.status, "status"),
    quantity: readNumber(value.quantity, "quantity"),
    remainingQuantity: readNumber(value.remainingQuantity, "remainingQuantity"),
    priceCents: readString(value.priceCents, "priceCents"),
    reservedCashCents: readString(value.reservedCashCents, "reservedCashCents"),
    reservedQuantity: readNumber(value.reservedQuantity, "reservedQuantity"),
    tickPlaced: readNumber(value.tickPlaced, "tickPlaced"),
    tickClosed: tickClosedValue === null ? null : readNumber(tickClosedValue, "tickClosed"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt"),
    closedAt: readNullableString(value.closedAt, "closedAt")
  };
}

export function parseMarketOrders(value: unknown): MarketOrder[] {
  return readArray(value, "marketOrders").map(parseMarketOrder);
}

export function parseMarketTrade(value: unknown): MarketTrade {
  if (!isRecord(value)) {
    throw new Error("Invalid market trade");
  }

  return {
    id: readString(value.id, "id"),
    tick: readNumber(value.tick, "tick"),
    itemId: readString(value.itemId, "itemId"),
    regionId: readString(value.regionId, "regionId"),
    buyerId: readString(value.buyerId, "buyerId"),
    sellerId: readString(value.sellerId, "sellerId"),
    priceCents: readString(value.priceCents, "priceCents"),
    quantity: readNumber(value.quantity, "quantity"),
    createdAt: readString(value.createdAt, "createdAt")
  };
}

export function parseMarketCandle(value: unknown): MarketCandle {
  if (!isRecord(value)) {
    throw new Error("Invalid market candle");
  }

  return {
    id: readString(value.id, "id"),
    itemId: readString(value.itemId, "itemId"),
    regionId: readString(value.regionId, "regionId"),
    tick: readNumber(value.tick, "tick"),
    openCents: readString(value.openCents, "openCents"),
    highCents: readString(value.highCents, "highCents"),
    lowCents: readString(value.lowCents, "lowCents"),
    closeCents: readString(value.closeCents, "closeCents"),
    volumeQty: readNumber(value.volumeQty, "volumeQty"),
    tradeCount: readNumber(value.tradeCount, "tradeCount"),
    vwapCents: value.vwapCents === null ? null : readString(value.vwapCents, "vwapCents"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt")
  };
}

export function parseMarketAnalyticsSummary(value: unknown): MarketAnalyticsSummary {
  if (!isRecord(value)) {
    throw new Error("Invalid market analytics summary");
  }

  return {
    itemId: readString(value.itemId, "itemId"),
    regionId: readString(value.regionId, "regionId"),
    fromTick: readNumber(value.fromTick, "fromTick"),
    toTick: readNumber(value.toTick, "toTick"),
    candleCount: readNumber(value.candleCount, "candleCount"),
    lastPriceCents:
      value.lastPriceCents === null ? null : readString(value.lastPriceCents, "lastPriceCents"),
    changePctBps:
      value.changePctBps === null ? null : readNumber(value.changePctBps, "changePctBps"),
    highCents: value.highCents === null ? null : readString(value.highCents, "highCents"),
    lowCents: value.lowCents === null ? null : readString(value.lowCents, "lowCents"),
    avgVolumeQty: readNumber(value.avgVolumeQty, "avgVolumeQty"),
    totalVolumeQty: readNumber(value.totalVolumeQty, "totalVolumeQty"),
    vwapCents: value.vwapCents === null ? null : readString(value.vwapCents, "vwapCents")
  };
}

export function parseItemCatalogItem(value: unknown): ItemCatalogItem {
  if (!isRecord(value)) {
    throw new Error("Invalid item catalog row");
  }

  return {
    id: readString(value.id, "id"),
    code: readString(value.code, "code"),
    name: readString(value.name, "name")
  };
}

export function parseProductionRecipe(value: unknown): ProductionRecipe {
  if (!isRecord(value)) {
    throw new Error("Invalid production recipe row");
  }

  if (!isRecord(value.outputItem)) {
    throw new Error("Invalid production recipe output item");
  }

  return {
    id: readString(value.id, "id"),
    code: readString(value.code, "code"),
    name: readString(value.name, "name"),
    durationTicks: readNumber(value.durationTicks, "durationTicks"),
    outputQuantity: readNumber(value.outputQuantity, "outputQuantity"),
    outputItem: {
      id: readString(value.outputItem.id, "outputItem.id"),
      code: readString(value.outputItem.code, "outputItem.code"),
      name: readString(value.outputItem.name, "outputItem.name")
    },
    inputs: readArray(value.inputs, "inputs").map((inputValue) => {
      if (!isRecord(inputValue)) {
        throw new Error("Invalid production recipe input row");
      }
      if (!isRecord(inputValue.item)) {
        throw new Error("Invalid production recipe input item");
      }

      return {
        itemId: readString(inputValue.itemId, "input.itemId"),
        quantityPerRun: readNumber(inputValue.quantityPerRun, "input.quantityPerRun"),
        item: {
          id: readString(inputValue.item.id, "input.item.id"),
          code: readString(inputValue.item.code, "input.item.code"),
          name: readString(inputValue.item.name, "input.item.name")
        }
      };
    })
  };
}

export function parseProductionJobStatus(value: unknown): ProductionJobStatus {
  const status = readString(value, "status");
  if (status !== "RUNNING" && status !== "COMPLETED" && status !== "CANCELLED") {
    throw new Error("Invalid production job status");
  }
  return status;
}

export function parseProductionJob(value: unknown): ProductionJob {
  if (!isRecord(value)) {
    throw new Error("Invalid production job row");
  }
  if (!isRecord(value.recipe)) {
    throw new Error("Invalid production job recipe");
  }
  if (!isRecord(value.recipe.outputItem)) {
    throw new Error("Invalid production job output item");
  }

  return {
    id: readString(value.id, "id"),
    companyId: readString(value.companyId, "companyId"),
    recipeId: readString(value.recipeId, "recipeId"),
    status: parseProductionJobStatus(value.status),
    quantity: readNumber(value.quantity, "quantity"),
    tickStarted: readNumber(value.tickStarted, "tickStarted"),
    tickCompletionExpected: readNumber(value.tickCompletionExpected, "tickCompletionExpected"),
    tickCompleted: value.tickCompleted === null ? null : readNumber(value.tickCompleted, "tickCompleted"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt"),
    recipe: {
      id: readString(value.recipe.id, "recipe.id"),
      code: readString(value.recipe.code, "recipe.code"),
      name: readString(value.recipe.name, "recipe.name"),
      durationTicks: readNumber(value.recipe.durationTicks, "recipe.durationTicks"),
      outputQuantity: readNumber(value.recipe.outputQuantity, "recipe.outputQuantity"),
      outputItem: {
        id: readString(value.recipe.outputItem.id, "recipe.outputItem.id"),
        code: readString(value.recipe.outputItem.code, "recipe.outputItem.code"),
        name: readString(value.recipe.outputItem.name, "recipe.outputItem.name")
      },
      inputs: readArray(value.recipe.inputs, "recipe.inputs").map((inputValue) => {
        if (!isRecord(inputValue)) {
          throw new Error("Invalid production job input row");
        }
        if (!isRecord(inputValue.item)) {
          throw new Error("Invalid production job input item");
        }

        return {
          itemId: readString(inputValue.itemId, "recipe.input.itemId"),
          quantityPerRun: readNumber(inputValue.quantityPerRun, "recipe.input.quantityPerRun"),
          quantityTotal: readNumber(inputValue.quantityTotal, "recipe.input.quantityTotal"),
          item: {
            id: readString(inputValue.item.id, "recipe.input.item.id"),
            code: readString(inputValue.item.code, "recipe.input.item.code"),
            name: readString(inputValue.item.name, "recipe.input.item.name")
          }
        };
      })
    }
  };
}

export function parseResearchNodeStatus(value: unknown): ResearchNodeStatus {
  const status = readString(value, "status");
  if (status !== "LOCKED" && status !== "AVAILABLE" && status !== "RESEARCHING" && status !== "COMPLETED") {
    throw new Error("Invalid research node status");
  }
  return status;
}

export function parseResearchNode(value: unknown): ResearchNode {
  if (!isRecord(value)) {
    throw new Error("Invalid research node");
  }

  return {
    id: readString(value.id, "id"),
    code: readString(value.code, "code"),
    name: readString(value.name, "name"),
    description: readString(value.description, "description"),
    costCashCents: readString(value.costCashCents, "costCashCents"),
    durationTicks: readNumber(value.durationTicks, "durationTicks"),
    status: parseResearchNodeStatus(value.status),
    tickStarted:
      value.tickStarted === null ? null : readNumber(value.tickStarted, "tickStarted"),
    tickCompletes:
      value.tickCompletes === null ? null : readNumber(value.tickCompletes, "tickCompletes"),
    prerequisites: readArray(value.prerequisites, "prerequisites").map((entry) => {
      if (!isRecord(entry)) {
        throw new Error("Invalid research prerequisite");
      }
      return {
        nodeId: readString(entry.nodeId, "prerequisite.nodeId")
      };
    }),
    unlockRecipes: readArray(value.unlockRecipes, "unlockRecipes").map((entry) => {
      if (!isRecord(entry)) {
        throw new Error("Invalid unlock recipe row");
      }
      return {
        recipeId: readString(entry.recipeId, "unlockRecipe.recipeId"),
        recipeCode: readString(entry.recipeCode, "unlockRecipe.recipeCode"),
        recipeName: readString(entry.recipeName, "unlockRecipe.recipeName")
      };
    })
  };
}

export function parseResearchJob(value: unknown): ResearchJob {
  if (!isRecord(value)) {
    throw new Error("Invalid research job payload");
  }

  const status = readString(value.status, "status");
  if (status !== "RUNNING" && status !== "COMPLETED" && status !== "CANCELLED") {
    throw new Error("Invalid research job status");
  }

  return {
    id: readString(value.id, "id"),
    companyId: readString(value.companyId, "companyId"),
    nodeId: readString(value.nodeId, "nodeId"),
    status,
    costCashCents: readString(value.costCashCents, "costCashCents"),
    tickStarted: readNumber(value.tickStarted, "tickStarted"),
    tickCompletes: readNumber(value.tickCompletes, "tickCompletes"),
    tickClosed: value.tickClosed === null ? null : readNumber(value.tickClosed, "tickClosed"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt")
  };
}

export function parseContractStatus(value: unknown): ContractStatus {
  const status = readString(value, "status");
  if (
    status !== "OPEN" &&
    status !== "ACCEPTED" &&
    status !== "PARTIALLY_FULFILLED" &&
    status !== "FULFILLED" &&
    status !== "EXPIRED" &&
    status !== "CANCELLED"
  ) {
    throw new Error("Invalid contract status");
  }
  return status;
}

export function parseContractRecord(value: unknown): ContractRecord {
  if (!isRecord(value)) {
    throw new Error("Invalid contract row");
  }
  if (!isRecord(value.item)) {
    throw new Error("Invalid contract item");
  }
  if (!isRecord(value.buyerCompany)) {
    throw new Error("Invalid contract buyer company");
  }

  let sellerCompany: ContractRecord["sellerCompany"] = null;
  if (value.sellerCompany !== null) {
    if (!isRecord(value.sellerCompany)) {
      throw new Error("Invalid contract seller company");
    }
    sellerCompany = {
      id: readString(value.sellerCompany.id, "sellerCompany.id"),
      code: readString(value.sellerCompany.code, "sellerCompany.code"),
      name: readString(value.sellerCompany.name, "sellerCompany.name")
    };
  }

  return {
    id: readString(value.id, "id"),
    buyerCompanyId: readString(value.buyerCompanyId, "buyerCompanyId"),
    sellerCompanyId:
      value.sellerCompanyId === null ? null : readString(value.sellerCompanyId, "sellerCompanyId"),
    itemId: readString(value.itemId, "itemId"),
    quantity: readNumber(value.quantity, "quantity"),
    remainingQuantity: readNumber(value.remainingQuantity, "remainingQuantity"),
    priceCents: readString(value.priceCents, "priceCents"),
    status: parseContractStatus(value.status),
    tickCreated: readNumber(value.tickCreated, "tickCreated"),
    tickExpires: readNumber(value.tickExpires, "tickExpires"),
    tickAccepted:
      value.tickAccepted === null ? null : readNumber(value.tickAccepted, "tickAccepted"),
    tickClosed: value.tickClosed === null ? null : readNumber(value.tickClosed, "tickClosed"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt"),
    item: {
      id: readString(value.item.id, "item.id"),
      code: readString(value.item.code, "item.code"),
      name: readString(value.item.name, "item.name")
    },
    buyerCompany: {
      id: readString(value.buyerCompany.id, "buyerCompany.id"),
      code: readString(value.buyerCompany.code, "buyerCompany.code"),
      name: readString(value.buyerCompany.name, "buyerCompany.name")
    },
    sellerCompany
  };
}

export function parseContractFulfillmentResult(value: unknown): ContractFulfillmentResult {
  if (!isRecord(value)) {
    throw new Error("Invalid contract fulfillment payload");
  }
  if (!isRecord(value.fulfillment)) {
    throw new Error("Invalid contract fulfillment row");
  }

  return {
    contract: parseContractRecord(value.contract),
    fulfillment: {
      id: readString(value.fulfillment.id, "fulfillment.id"),
      contractId: readString(value.fulfillment.contractId, "fulfillment.contractId"),
      sellerCompanyId: readString(value.fulfillment.sellerCompanyId, "fulfillment.sellerCompanyId"),
      itemId: readString(value.fulfillment.itemId, "fulfillment.itemId"),
      quantity: readNumber(value.fulfillment.quantity, "fulfillment.quantity"),
      priceCents: readString(value.fulfillment.priceCents, "fulfillment.priceCents"),
      tick: readNumber(value.fulfillment.tick, "fulfillment.tick"),
      createdAt: readString(value.fulfillment.createdAt, "fulfillment.createdAt")
    }
  };
}

export function parseFinanceLedgerEntryType(value: unknown): FinanceLedgerEntryType {
  const entryType = readString(value, "entryType");
  if (
    entryType !== "ORDER_RESERVE" &&
    entryType !== "TRADE_SETTLEMENT" &&
    entryType !== "CONTRACT_SETTLEMENT" &&
    entryType !== "SHIPMENT_FEE" &&
    entryType !== "RESEARCH_PAYMENT" &&
    entryType !== "PRODUCTION_COMPLETION" &&
    entryType !== "PRODUCTION_COST" &&
    entryType !== "MANUAL_ADJUSTMENT"
  ) {
    throw new Error("Invalid finance ledger entry type");
  }
  return entryType;
}

export function parseFinanceLedgerEntry(value: unknown): FinanceLedgerEntry {
  if (!isRecord(value)) {
    throw new Error("Invalid finance ledger entry");
  }

  return {
    id: readString(value.id, "id"),
    tick: readNumber(value.tick, "tick"),
    entryType: parseFinanceLedgerEntryType(value.entryType),
    referenceType: readString(value.referenceType, "referenceType"),
    referenceId: readString(value.referenceId, "referenceId"),
    deltaCashCents: readString(value.deltaCashCents, "deltaCashCents"),
    deltaReservedCashCents: readString(value.deltaReservedCashCents, "deltaReservedCashCents"),
    balanceAfterCents: readString(value.balanceAfterCents, "balanceAfterCents"),
    createdAt: readString(value.createdAt, "createdAt")
  };
}

export function parseFinanceSummary(value: unknown): FinanceSummary {
  if (!isRecord(value)) {
    throw new Error("Invalid finance summary payload");
  }

  return {
    startingCashCents: readString(value.startingCashCents, "startingCashCents"),
    endingCashCents: readString(value.endingCashCents, "endingCashCents"),
    totalDeltaCashCents: readString(value.totalDeltaCashCents, "totalDeltaCashCents"),
    totalDeltaReservedCashCents: readString(
      value.totalDeltaReservedCashCents,
      "totalDeltaReservedCashCents"
    ),
    breakdownByEntryType: readArray(value.breakdownByEntryType, "breakdownByEntryType").map(
      (row) => {
        if (!isRecord(row)) {
          throw new Error("Invalid finance summary breakdown row");
        }
        return {
          entryType: parseFinanceLedgerEntryType(row.entryType),
          deltaCashCents: readString(row.deltaCashCents, "breakdown.deltaCashCents"),
          deltaReservedCashCents: readString(
            row.deltaReservedCashCents,
            "breakdown.deltaReservedCashCents"
          ),
          count: readNumber(row.count, "breakdown.count")
        };
      }
    ),
    tradesCount: readNumber(value.tradesCount, "tradesCount"),
    ordersPlacedCount: readNumber(value.ordersPlacedCount, "ordersPlacedCount"),
    ordersCancelledCount: readNumber(value.ordersCancelledCount, "ordersCancelledCount"),
    productionsCompletedCount: readNumber(
      value.productionsCompletedCount,
      "productionsCompletedCount"
    )
  };
}

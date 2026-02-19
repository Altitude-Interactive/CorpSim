import type {
  BuildingCategory,
  BuildingRecord,
  BuildingStatus,
  BuildingType,
  BuildingTypeDefinition,
  CompanySpecialization,
  CompanySpecializationOption,
  DatabaseSchemaReadiness,
  DatabaseSchemaReadinessStatus,
  ItemCategory,
  CompanyDetails,
  CompanyWorkforce,
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
  OnboardingStatus,
  PlayerIdentity,
  PlayerRegistryCompany,
  PlayerRegistryEntry,
  PlayerRegistryItemHolding,
  PreflightValidationResult,
  ProductionCapacityInfo,
  ProductionJob,
  ProductionJobStatus,
  ProductionRecipe,
  RegionalStorageInfo,
  RegionSummary,
  ResearchJob,
  ResearchNode,
  ResearchNodeStatus,
  ShipmentRecord,
  ValidationIssue,
  WorkforceCapacityChangeResult,
  WorldHealth,
  WorldTickState
} from "@corpsim/shared";
import { COMPANY_SPECIALIZATION_CODES, ITEM_CATEGORY_CODES } from "@corpsim/shared";
import { isRecord, readArray, readBoolean, readNullableString, readNumber, readString } from "./api-client";

function parseCompanySpecialization(value: unknown): CompanySpecialization {
  const specialization = readString(value, "specialization");
  if (!COMPANY_SPECIALIZATION_CODES.includes(specialization as CompanySpecialization)) {
    throw new Error("Invalid company specialization");
  }
  return specialization as CompanySpecialization;
}

function parseItemCategory(value: unknown): ItemCategory {
  const category = readString(value, "itemCategory");
  if (!ITEM_CATEGORY_CODES.includes(category as ItemCategory)) {
    throw new Error("Invalid item category");
  }
  return category as ItemCategory;
}

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
    specialization: parseCompanySpecialization(value.specialization),
    cashCents: readString(value.cashCents, "cashCents"),
    regionId: readString(value.regionId, "regionId"),
    regionCode: readString(value.regionCode, "regionCode"),
    regionName: readString(value.regionName, "regionName")
  };
}

function parseDatabaseSchemaReadinessStatus(value: unknown): DatabaseSchemaReadinessStatus {
  const status = readString(value, "status");
  if (status !== "ready" && status !== "schema-out-of-date" && status !== "schema-check-failed") {
    throw new Error("Invalid database schema readiness status");
  }
  return status;
}

export function parseDatabaseSchemaReadiness(value: unknown): DatabaseSchemaReadiness {
  if (!isRecord(value)) {
    throw new Error("Invalid database schema readiness payload");
  }

  return {
    ready: readBoolean(value.ready, "ready"),
    status: parseDatabaseSchemaReadinessStatus(value.status),
    checkedAt: readString(value.checkedAt, "checkedAt"),
    issues: readArray(value.issues, "issues").map((entry) => readString(entry, "issue")),
    pendingMigrations: readArray(value.pendingMigrations, "pendingMigrations").map((entry) =>
      readString(entry, "pendingMigration")
    ),
    failedMigrations: readArray(value.failedMigrations, "failedMigrations").map((entry) =>
      readString(entry, "failedMigration")
    ),
    extraDatabaseMigrations: readArray(
      value.extraDatabaseMigrations,
      "extraDatabaseMigrations"
    ).map((entry) => readString(entry, "extraDatabaseMigration"))
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
    specialization: parseCompanySpecialization(value.specialization),
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

export function parseOnboardingStatus(value: unknown): OnboardingStatus {
  if (!isRecord(value)) {
    throw new Error("Invalid onboarding status payload");
  }

  return {
    completed: readBoolean(value.completed, "completed"),
    tutorialCompleted: readBoolean(value.tutorialCompleted, "tutorialCompleted"),
    companyId: readNullableString(value.companyId, "companyId"),
    companyName: readNullableString(value.companyName, "companyName"),
    regionId: readNullableString(value.regionId, "regionId")
  };
}

export function parsePlayerRegistryItemHolding(value: unknown): PlayerRegistryItemHolding {
  if (!isRecord(value)) {
    throw new Error("Invalid player registry item holding");
  }

  return {
    itemId: readString(value.itemId, "itemId"),
    itemCode: readString(value.itemCode, "itemCode"),
    itemName: readString(value.itemName, "itemName"),
    quantity: readNumber(value.quantity, "quantity"),
    reservedQuantity: readNumber(value.reservedQuantity, "reservedQuantity")
  };
}

export function parsePlayerRegistryCompany(value: unknown): PlayerRegistryCompany {
  if (!isRecord(value)) {
    throw new Error("Invalid player registry company");
  }

  return {
    id: readString(value.id, "id"),
    code: readString(value.code, "code"),
    name: readString(value.name, "name"),
    isBot: readBoolean(value.isBot, "isBot"),
    cashCents: readString(value.cashCents, "cashCents"),
    regionId: readString(value.regionId, "regionId"),
    regionCode: readString(value.regionCode, "regionCode"),
    regionName: readString(value.regionName, "regionName"),
    itemHoldings: readArray(value.itemHoldings, "itemHoldings").map(parsePlayerRegistryItemHolding)
  };
}

export function parsePlayerRegistryEntry(value: unknown): PlayerRegistryEntry {
  if (!isRecord(value)) {
    throw new Error("Invalid player registry entry");
  }

  return {
    id: readString(value.id, "id"),
    handle: readString(value.handle, "handle"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt"),
    companies: readArray(value.companies, "companies").map(parsePlayerRegistryCompany)
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
  const status = readString(value.status, "status");
  if (status !== "OPEN" && status !== "FILLED" && status !== "CANCELLED") {
    throw new Error("Invalid market order status");
  }

  const tickClosedValue = value.tickClosed;

  return {
    id: readString(value.id, "id"),
    companyId: readString(value.companyId, "companyId"),
    itemId: readString(value.itemId, "itemId"),
    regionId: readString(value.regionId, "regionId"),
    side,
    status,
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
  if (Array.isArray(value)) {
    return value.map(parseMarketOrder);
  }
  if (!isRecord(value)) {
    throw new Error("Invalid market orders payload");
  }
  return readArray(value.marketOrders, "marketOrders").map(parseMarketOrder);
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

export function parseCompanySpecializationOption(
  value: unknown
): CompanySpecializationOption {
  if (!isRecord(value)) {
    throw new Error("Invalid company specialization option");
  }

  return {
    code: parseCompanySpecialization(value.code),
    label: readString(value.label, "label"),
    description: readString(value.description, "description"),
    unlockedCategories: readArray(value.unlockedCategories, "unlockedCategories").map(
      parseItemCategory
    ),
    sampleItemCodes: readArray(value.sampleItemCodes, "sampleItemCodes").map((entry) =>
      readString(entry, "sampleItemCode")
    )
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
    entryType !== "WORKFORCE_SALARY_EXPENSE" &&
    entryType !== "WORKFORCE_RECRUITMENT_EXPENSE" &&
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

export function parseCompanyWorkforce(value: unknown): CompanyWorkforce {
  if (!isRecord(value)) {
    throw new Error("Invalid workforce payload");
  }
  if (!isRecord(value.projectedModifiers)) {
    throw new Error("Invalid workforce projected modifiers payload");
  }

  return {
    companyId: readString(value.companyId, "companyId"),
    workforceCapacity: readNumber(value.workforceCapacity, "workforceCapacity"),
    workforceAllocationOpsPct: readNumber(
      value.workforceAllocationOpsPct,
      "workforceAllocationOpsPct"
    ),
    workforceAllocationRngPct: readNumber(
      value.workforceAllocationRngPct,
      "workforceAllocationRngPct"
    ),
    workforceAllocationLogPct: readNumber(
      value.workforceAllocationLogPct,
      "workforceAllocationLogPct"
    ),
    workforceAllocationCorpPct: readNumber(
      value.workforceAllocationCorpPct,
      "workforceAllocationCorpPct"
    ),
    orgEfficiencyBps: readNumber(value.orgEfficiencyBps, "orgEfficiencyBps"),
    weeklySalaryBurnCents: readString(value.weeklySalaryBurnCents, "weeklySalaryBurnCents"),
    projectedModifiers: {
      productionSpeedBonusBps: readNumber(
        value.projectedModifiers.productionSpeedBonusBps,
        "projectedModifiers.productionSpeedBonusBps"
      ),
      productionDurationMultiplierBps: readNumber(
        value.projectedModifiers.productionDurationMultiplierBps,
        "projectedModifiers.productionDurationMultiplierBps"
      ),
      researchSpeedBonusBps: readNumber(
        value.projectedModifiers.researchSpeedBonusBps,
        "projectedModifiers.researchSpeedBonusBps"
      ),
      researchDurationMultiplierBps: readNumber(
        value.projectedModifiers.researchDurationMultiplierBps,
        "projectedModifiers.researchDurationMultiplierBps"
      ),
      logisticsTravelReductionBps: readNumber(
        value.projectedModifiers.logisticsTravelReductionBps,
        "projectedModifiers.logisticsTravelReductionBps"
      ),
      logisticsTravelMultiplierBps: readNumber(
        value.projectedModifiers.logisticsTravelMultiplierBps,
        "projectedModifiers.logisticsTravelMultiplierBps"
      )
    },
    pendingHiringArrivals: readArray(value.pendingHiringArrivals, "pendingHiringArrivals").map(
      (row) => {
        if (!isRecord(row)) {
          throw new Error("Invalid pending hiring arrival row");
        }
        return {
          id: readString(row.id, "pendingHiringArrivals.id"),
          deltaCapacity: readNumber(row.deltaCapacity, "pendingHiringArrivals.deltaCapacity"),
          tickArrives: readNumber(row.tickArrives, "pendingHiringArrivals.tickArrives"),
          createdAt: readString(row.createdAt, "pendingHiringArrivals.createdAt")
        };
      }
    ),
    updatedAt: readString(value.updatedAt, "updatedAt")
  };
}

export function parseWorkforceCapacityChangeResult(
  value: unknown
): WorkforceCapacityChangeResult {
  if (!isRecord(value)) {
    throw new Error("Invalid workforce capacity change payload");
  }

  return {
    companyId: readString(value.companyId, "companyId"),
    deltaCapacity: readNumber(value.deltaCapacity, "deltaCapacity"),
    appliedImmediately: readBoolean(value.appliedImmediately, "appliedImmediately"),
    tickRequested: readNumber(value.tickRequested, "tickRequested"),
    tickArrives: value.tickArrives === null ? null : readNumber(value.tickArrives, "tickArrives"),
    recruitmentCostCents: readString(value.recruitmentCostCents, "recruitmentCostCents"),
    workforceCapacity: readNumber(value.workforceCapacity, "workforceCapacity"),
    orgEfficiencyBps: readNumber(value.orgEfficiencyBps, "orgEfficiencyBps")
  };
}

export function parseBuildingRecord(value: unknown): BuildingRecord {
  if (!isRecord(value)) {
    throw new Error("Invalid building record payload");
  }

  if (!isRecord(value.region)) {
    throw new Error("Invalid building region payload");
  }

  return {
    id: readString(value.id, "id"),
    companyId: readString(value.companyId, "companyId"),
    regionId: readString(value.regionId, "regionId"),
    buildingType: readString(value.buildingType, "buildingType") as BuildingType,
    status: readString(value.status, "status") as BuildingStatus,
    name: readNullableString(value.name, "name"),
    acquisitionCostCents: readString(value.acquisitionCostCents, "acquisitionCostCents"),
    weeklyOperatingCostCents: readString(
      value.weeklyOperatingCostCents,
      "weeklyOperatingCostCents"
    ),
    capacitySlots: readNumber(value.capacitySlots, "capacitySlots"),
    tickAcquired: readNumber(value.tickAcquired, "tickAcquired"),
    tickConstructionCompletes:
      value.tickConstructionCompletes === null
        ? null
        : readNumber(value.tickConstructionCompletes, "tickConstructionCompletes"),
    lastOperatingCostTick:
      value.lastOperatingCostTick === null
        ? null
        : readNumber(value.lastOperatingCostTick, "lastOperatingCostTick"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt"),
    region: {
      id: readString(value.region.id, "region.id"),
      code: readString(value.region.code, "region.code"),
      name: readString(value.region.name, "region.name")
    }
  };
}

export function parseRegionalStorageInfo(value: unknown): RegionalStorageInfo {
  if (!isRecord(value)) {
    throw new Error("Invalid regional storage info payload");
  }

  return {
    companyId: readString(value.companyId, "companyId"),
    regionId: readString(value.regionId, "regionId"),
    currentUsage: readNumber(value.currentUsage, "currentUsage"),
    maxCapacity: readNumber(value.maxCapacity, "maxCapacity"),
    usagePercentage: readNumber(value.usagePercentage, "usagePercentage"),
    warehouseCount: readNumber(value.warehouseCount, "warehouseCount")
  };
}

export function parseProductionCapacityInfo(value: unknown): ProductionCapacityInfo {
  if (!isRecord(value)) {
    throw new Error("Invalid production capacity info payload");
  }

  return {
    companyId: readString(value.companyId, "companyId"),
    totalCapacity: readNumber(value.totalCapacity, "totalCapacity"),
    usedCapacity: readNumber(value.usedCapacity, "usedCapacity"),
    availableCapacity: readNumber(value.availableCapacity, "availableCapacity"),
    usagePercentage: readNumber(value.usagePercentage, "usagePercentage")
  };
}

export function parseValidationIssue(value: unknown): ValidationIssue {
  if (!isRecord(value)) {
    throw new Error("Invalid validation issue payload");
  }

  return {
    code: readString(value.code, "code"),
    message: readString(value.message, "message"),
    severity: readString(value.severity, "severity") as "ERROR" | "WARNING"
  };
}

export function parsePreflightValidationResult(value: unknown): PreflightValidationResult {
  if (!isRecord(value)) {
    throw new Error("Invalid preflight validation result payload");
  }

  return {
    valid: readBoolean(value.valid, "valid"),
    issues: readArray(value.issues, "issues").map(parseValidationIssue)
  };
}

export function parseBuildingTypeDefinition(value: unknown): BuildingTypeDefinition {
  if (!isRecord(value)) {
    throw new Error("Invalid building type definition payload");
  }

  return {
    buildingType: readString(value.buildingType, "buildingType") as BuildingType,
    category: readString(value.category, "category") as BuildingCategory,
    name: readString(value.name, "name"),
    description: readString(value.description, "description"),
    acquisitionCostCents: readString(value.acquisitionCostCents, "acquisitionCostCents"),
    weeklyOperatingCostCents: readString(
      value.weeklyOperatingCostCents,
      "weeklyOperatingCostCents"
    ),
    capacitySlots: readNumber(value.capacitySlots, "capacitySlots"),
    storageCapacity:
      value.storageCapacity === undefined
        ? undefined
        : readNumber(value.storageCapacity, "storageCapacity")
  };
}



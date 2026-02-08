export const HEALTH_POLL_INTERVAL_MS = 3_000;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const PLAYER_HANDLE_STORAGE_KEY = "corpsim.playerHandle";
const DEFAULT_PLAYER_HANDLE = "PLAYER";

type JsonRecord = Record<string, unknown>;

export class ApiClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export interface InvariantIssue {
  code: string;
  entityType: "company" | "inventory";
  companyId: string;
  itemId?: string;
  message: string;
}

export interface WorldHealth {
  currentTick: number;
  lockVersion: number;
  lastAdvancedAt: string | null;
  ordersOpenCount: number;
  ordersTotalCount: number;
  tradesLast100Count: number;
  companiesCount: number;
  botsCount: number;
  sumCashCents: string;
  sumReservedCashCents: string;
  invariants: {
    hasViolations: boolean;
    truncated: boolean;
    issues: InvariantIssue[];
  };
}

export interface WorldTickState {
  currentTick: number;
  lockVersion: number;
  lastAdvancedAt: string | null;
}

export interface CompanySummary {
  id: string;
  code: string;
  name: string;
  isBot: boolean;
  cashCents: string;
}

export interface CompanyDetails extends CompanySummary {
  reservedCashCents: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerIdentity {
  id: string;
  handle: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryRow {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  reservedQuantity: number;
}

export interface MarketOrder {
  id: string;
  companyId: string;
  itemId: string;
  side: "BUY" | "SELL";
  status: string;
  quantity: number;
  remainingQuantity: number;
  priceCents: string;
  reservedCashCents: string;
  reservedQuantity: number;
  tickPlaced: number;
  tickClosed: number | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
}

export interface MarketOrderFilters {
  itemId?: string;
  side?: "BUY" | "SELL";
  companyId?: string;
  limit?: number;
}

export interface MarketTrade {
  id: string;
  tick: number;
  itemId: string;
  buyerId: string;
  sellerId: string;
  priceCents: string;
  quantity: number;
  createdAt: string;
}

export interface MarketTradeFilters {
  itemId?: string;
  companyId?: string;
  limit?: number;
}

export interface MarketCandle {
  id: string;
  itemId: string;
  tick: number;
  openCents: string;
  highCents: string;
  lowCents: string;
  closeCents: string;
  volumeQty: number;
  tradeCount: number;
  vwapCents: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketCandleFilters {
  itemId: string;
  fromTick?: number;
  toTick?: number;
  limit?: number;
}

export interface MarketAnalyticsSummary {
  itemId: string;
  fromTick: number;
  toTick: number;
  candleCount: number;
  lastPriceCents: string | null;
  changePctBps: number | null;
  highCents: string | null;
  lowCents: string | null;
  avgVolumeQty: number;
  totalVolumeQty: number;
  vwapCents: string | null;
}

export interface ItemCatalogItem {
  id: string;
  code: string;
  name: string;
}

export interface PlaceMarketOrderInput {
  companyId: string;
  itemId: string;
  side: "BUY" | "SELL";
  priceCents: number;
  quantity: number;
}

export interface ProductionRecipeInput {
  itemId: string;
  quantityPerRun: number;
  item: {
    id: string;
    code: string;
    name: string;
  };
}

export interface ProductionRecipe {
  id: string;
  code: string;
  name: string;
  durationTicks: number;
  outputQuantity: number;
  outputItem: {
    id: string;
    code: string;
    name: string;
  };
  inputs: ProductionRecipeInput[];
}

export type ProductionJobStatus = "RUNNING" | "COMPLETED" | "CANCELLED";

export interface ProductionJob {
  id: string;
  companyId: string;
  recipeId: string;
  status: ProductionJobStatus;
  quantity: number;
  tickStarted: number;
  tickCompletionExpected: number;
  tickCompleted: number | null;
  createdAt: string;
  updatedAt: string;
  recipe: {
    id: string;
    code: string;
    name: string;
    durationTicks: number;
    outputQuantity: number;
    outputItem: {
      id: string;
      code: string;
      name: string;
    };
    inputs: Array<{
      itemId: string;
      quantityPerRun: number;
      quantityTotal: number;
      item: {
        id: string;
        code: string;
        name: string;
      };
    }>;
  };
}

export interface ProductionJobFilters {
  companyId?: string;
  status?: ProductionJobStatus;
  limit?: number;
}

export interface CreateProductionJobInput {
  companyId: string;
  recipeId: string;
  quantity: number;
}

export type ResearchNodeStatus = "LOCKED" | "AVAILABLE" | "RESEARCHING" | "COMPLETED";

export interface ResearchNodeRecipeUnlock {
  recipeId: string;
  recipeCode: string;
  recipeName: string;
}

export interface ResearchNodePrerequisite {
  nodeId: string;
}

export interface ResearchNode {
  id: string;
  code: string;
  name: string;
  description: string;
  costCashCents: string;
  durationTicks: number;
  status: ResearchNodeStatus;
  tickStarted: number | null;
  tickCompletes: number | null;
  prerequisites: ResearchNodePrerequisite[];
  unlockRecipes: ResearchNodeRecipeUnlock[];
}

export interface ResearchJob {
  id: string;
  companyId: string;
  nodeId: string;
  status: "RUNNING" | "COMPLETED" | "CANCELLED";
  costCashCents: string;
  tickStarted: number;
  tickCompletes: number;
  tickClosed: number | null;
  createdAt: string;
  updatedAt: string;
}

export type ContractStatus =
  | "OPEN"
  | "ACCEPTED"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "EXPIRED"
  | "CANCELLED";

export interface ContractRecord {
  id: string;
  buyerCompanyId: string;
  sellerCompanyId: string | null;
  itemId: string;
  quantity: number;
  remainingQuantity: number;
  priceCents: string;
  status: ContractStatus;
  tickCreated: number;
  tickExpires: number;
  tickAccepted: number | null;
  tickClosed: number | null;
  createdAt: string;
  updatedAt: string;
  item: {
    id: string;
    code: string;
    name: string;
  };
  buyerCompany: {
    id: string;
    code: string;
    name: string;
  };
  sellerCompany: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface ContractFulfillmentResult {
  contract: ContractRecord;
  fulfillment: {
    id: string;
    contractId: string;
    sellerCompanyId: string;
    itemId: string;
    quantity: number;
    priceCents: string;
    tick: number;
    createdAt: string;
  };
}

export interface ListContractsFilters {
  status?: ContractStatus;
  itemId?: string;
  limit?: number;
}

export type FinanceLedgerEntryType =
  | "ORDER_RESERVE"
  | "TRADE_SETTLEMENT"
  | "CONTRACT_SETTLEMENT"
  | "RESEARCH_PAYMENT"
  | "PRODUCTION_COMPLETION"
  | "PRODUCTION_COST"
  | "MANUAL_ADJUSTMENT";

export interface FinanceLedgerEntry {
  id: string;
  tick: number;
  entryType: FinanceLedgerEntryType;
  referenceType: string;
  referenceId: string;
  deltaCashCents: string;
  deltaReservedCashCents: string;
  balanceAfterCents: string;
  createdAt: string;
}

export interface FinanceLedgerResult {
  entries: FinanceLedgerEntry[];
  nextCursor: string | null;
}

export interface FinanceLedgerFilters {
  companyId: string;
  fromTick?: number;
  toTick?: number;
  entryType?: FinanceLedgerEntryType;
  referenceType?: string;
  referenceId?: string;
  limit?: number;
  cursor?: string;
}

export interface FinanceSummaryBreakdownRow {
  entryType: FinanceLedgerEntryType;
  deltaCashCents: string;
  deltaReservedCashCents: string;
  count: number;
}

export interface FinanceSummary {
  startingCashCents: string;
  endingCashCents: string;
  totalDeltaCashCents: string;
  totalDeltaReservedCashCents: string;
  breakdownByEntryType: FinanceSummaryBreakdownRow[];
  tradesCount: number;
  ordersPlacedCount: number;
  ordersCancelledCount: number;
  productionsCompletedCount: number;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid response field "${field}" (expected string)`);
  }
  return value;
}

function readNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  return readString(value, field);
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid response field "${field}" (expected number)`);
  }
  return value;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid response field "${field}" (expected boolean)`);
  }
  return value;
}

function readArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid response field "${field}" (expected array)`);
  }
  return value;
}

function resolvePlayerHandle(): string {
  if (typeof window === "undefined") {
    return DEFAULT_PLAYER_HANDLE;
  }

  const fromStorage = window.localStorage.getItem(PLAYER_HANDLE_STORAGE_KEY)?.trim();
  return fromStorage && fromStorage.length > 0 ? fromStorage : DEFAULT_PLAYER_HANDLE;
}

async function fetchJson<T>(
  path: string,
  parser: (value: unknown) => T,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Player-Handle": resolvePlayerHandle(),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    if (isRecord(payload)) {
      if (typeof payload.message === "string") {
        message = payload.message;
      } else if (Array.isArray(payload.message)) {
        message = payload.message.filter((entry) => typeof entry === "string").join(", ");
      }
    }
    throw new ApiClientError(response.status, message);
  }

  return parser(payload);
}

function parseInvariantIssue(value: unknown): InvariantIssue {
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

function parseWorldHealth(value: unknown): WorldHealth {
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

function parseWorldTickState(value: unknown): WorldTickState {
  if (!isRecord(value)) {
    throw new Error("Invalid world tick payload");
  }

  return {
    currentTick: readNumber(value.currentTick, "currentTick"),
    lockVersion: readNumber(value.lockVersion, "lockVersion"),
    lastAdvancedAt: readNullableString(value.lastAdvancedAt, "lastAdvancedAt")
  };
}

function parseCompanySummary(value: unknown): CompanySummary {
  if (!isRecord(value)) {
    throw new Error("Invalid company item");
  }

  return {
    id: readString(value.id, "id"),
    code: readString(value.code, "code"),
    name: readString(value.name, "name"),
    isBot: readBoolean(value.isBot, "isBot"),
    cashCents: readString(value.cashCents, "cashCents")
  };
}

function parseCompanyDetails(value: unknown): CompanyDetails {
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
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt")
  };
}

function parsePlayerIdentity(value: unknown): PlayerIdentity {
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

function parseInventoryRow(value: unknown): InventoryRow {
  if (!isRecord(value)) {
    throw new Error("Invalid inventory item");
  }

  return {
    itemId: readString(value.itemId, "itemId"),
    itemCode: readString(value.itemCode, "itemCode"),
    itemName: readString(value.itemName, "itemName"),
    quantity: readNumber(value.quantity, "quantity"),
    reservedQuantity: readNumber(value.reservedQuantity, "reservedQuantity")
  };
}

function parseMarketOrder(value: unknown): MarketOrder {
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

function parseMarketOrders(value: unknown): MarketOrder[] {
  return readArray(value, "marketOrders").map(parseMarketOrder);
}

function parseMarketTrade(value: unknown): MarketTrade {
  if (!isRecord(value)) {
    throw new Error("Invalid market trade");
  }

  return {
    id: readString(value.id, "id"),
    tick: readNumber(value.tick, "tick"),
    itemId: readString(value.itemId, "itemId"),
    buyerId: readString(value.buyerId, "buyerId"),
    sellerId: readString(value.sellerId, "sellerId"),
    priceCents: readString(value.priceCents, "priceCents"),
    quantity: readNumber(value.quantity, "quantity"),
    createdAt: readString(value.createdAt, "createdAt")
  };
}

function parseMarketCandle(value: unknown): MarketCandle {
  if (!isRecord(value)) {
    throw new Error("Invalid market candle");
  }

  return {
    id: readString(value.id, "id"),
    itemId: readString(value.itemId, "itemId"),
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

function parseMarketAnalyticsSummary(value: unknown): MarketAnalyticsSummary {
  if (!isRecord(value)) {
    throw new Error("Invalid market analytics summary");
  }

  return {
    itemId: readString(value.itemId, "itemId"),
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

function parseItemCatalogItem(value: unknown): ItemCatalogItem {
  if (!isRecord(value)) {
    throw new Error("Invalid item catalog row");
  }

  return {
    id: readString(value.id, "id"),
    code: readString(value.code, "code"),
    name: readString(value.name, "name")
  };
}

function parseProductionRecipe(value: unknown): ProductionRecipe {
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

function parseProductionJobStatus(value: unknown): ProductionJobStatus {
  const status = readString(value, "status");
  if (status !== "RUNNING" && status !== "COMPLETED" && status !== "CANCELLED") {
    throw new Error("Invalid production job status");
  }
  return status;
}

function parseProductionJob(value: unknown): ProductionJob {
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

function parseResearchNodeStatus(value: unknown): ResearchNodeStatus {
  const status = readString(value, "status");
  if (status !== "LOCKED" && status !== "AVAILABLE" && status !== "RESEARCHING" && status !== "COMPLETED") {
    throw new Error("Invalid research node status");
  }
  return status;
}

function parseResearchNode(value: unknown): ResearchNode {
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

function parseResearchJob(value: unknown): ResearchJob {
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

function parseContractStatus(value: unknown): ContractStatus {
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

function parseContractRecord(value: unknown): ContractRecord {
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

function parseContractFulfillmentResult(value: unknown): ContractFulfillmentResult {
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

function parseFinanceLedgerEntryType(value: unknown): FinanceLedgerEntryType {
  const entryType = readString(value, "entryType");
  if (
    entryType !== "ORDER_RESERVE" &&
    entryType !== "TRADE_SETTLEMENT" &&
    entryType !== "CONTRACT_SETTLEMENT" &&
    entryType !== "RESEARCH_PAYMENT" &&
    entryType !== "PRODUCTION_COMPLETION" &&
    entryType !== "PRODUCTION_COST" &&
    entryType !== "MANUAL_ADJUSTMENT"
  ) {
    throw new Error("Invalid finance ledger entry type");
  }
  return entryType;
}

function parseFinanceLedgerEntry(value: unknown): FinanceLedgerEntry {
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

function parseFinanceSummary(value: unknown): FinanceSummary {
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

export async function getWorldHealth(): Promise<WorldHealth> {
  return fetchJson("/v1/world/health", parseWorldHealth);
}

export async function listCompanies(): Promise<CompanySummary[]> {
  return fetchJson("/v1/companies", (value) =>
    readArray(value, "companies").map(parseCompanySummary)
  );
}

export async function getCompany(companyId: string): Promise<CompanyDetails> {
  return fetchJson(`/v1/companies/${companyId}`, parseCompanyDetails);
}

export async function getMePlayer(): Promise<PlayerIdentity> {
  return fetchJson("/v1/players/me", parsePlayerIdentity);
}

export async function listMyCompanies(): Promise<CompanySummary[]> {
  return fetchJson("/v1/players/me/companies", (value) =>
    readArray(value, "companies").map(parseCompanySummary)
  );
}

export async function listCompanyInventory(companyId: string): Promise<InventoryRow[]> {
  return fetchJson(`/v1/companies/${companyId}/inventory`, (value) =>
    readArray(value, "inventory").map(parseInventoryRow)
  );
}

export async function listMarketOrders(filters: MarketOrderFilters): Promise<MarketOrder[]> {
  const params = new URLSearchParams();
  if (filters.itemId) {
    params.set("itemId", filters.itemId);
  }
  if (filters.side) {
    params.set("side", filters.side);
  }
  if (filters.companyId) {
    params.set("companyId", filters.companyId);
  }
  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }

  const query = params.toString();
  return fetchJson(`/v1/market/orders${query ? `?${query}` : ""}`, parseMarketOrders);
}

export async function placeMarketOrder(input: PlaceMarketOrderInput): Promise<MarketOrder> {
  return fetchJson("/v1/market/orders", parseMarketOrder, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function cancelMarketOrder(orderId: string): Promise<MarketOrder> {
  return fetchJson(`/v1/market/orders/${orderId}/cancel`, parseMarketOrder, {
    method: "POST"
  });
}

export async function listMarketTrades(filters: MarketTradeFilters): Promise<MarketTrade[]> {
  const params = new URLSearchParams();
  if (filters.itemId) {
    params.set("itemId", filters.itemId);
  }
  if (filters.companyId) {
    params.set("companyId", filters.companyId);
  }
  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }

  const query = params.toString();
  return fetchJson(`/v1/market/trades${query ? `?${query}` : ""}`, (value) =>
    readArray(value, "marketTrades").map(parseMarketTrade)
  );
}

export async function listMarketCandles(filters: MarketCandleFilters): Promise<MarketCandle[]> {
  const params = new URLSearchParams();
  params.set("itemId", filters.itemId);

  if (filters.fromTick !== undefined) {
    params.set("fromTick", String(filters.fromTick));
  }
  if (filters.toTick !== undefined) {
    params.set("toTick", String(filters.toTick));
  }
  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }

  return fetchJson(`/v1/market/candles?${params.toString()}`, (value) =>
    readArray(value, "marketCandles").map(parseMarketCandle)
  );
}

export async function getMarketAnalyticsSummary(
  itemId: string,
  windowTicks = 200
): Promise<MarketAnalyticsSummary> {
  const params = new URLSearchParams();
  params.set("itemId", itemId);
  params.set("windowTicks", String(windowTicks));

  return fetchJson(`/v1/market/analytics/summary?${params.toString()}`, parseMarketAnalyticsSummary);
}

export async function listItems(): Promise<ItemCatalogItem[]> {
  return fetchJson("/v1/items", (value) => readArray(value, "items").map(parseItemCatalogItem));
}

export async function listProductionRecipes(): Promise<ProductionRecipe[]> {
  return fetchJson("/v1/production/recipes", (value) =>
    readArray(value, "recipes").map(parseProductionRecipe)
  );
}

export async function listProductionJobs(filters: ProductionJobFilters): Promise<ProductionJob[]> {
  const params = new URLSearchParams();
  if (filters.companyId) {
    params.set("companyId", filters.companyId);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }

  const query = params.toString();
  return fetchJson(`/v1/production/jobs${query ? `?${query}` : ""}`, (value) =>
    readArray(value, "productionJobs").map(parseProductionJob)
  );
}

export async function createProductionJob(input: CreateProductionJobInput): Promise<ProductionJob> {
  return fetchJson("/v1/production/jobs", parseProductionJob, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function cancelProductionJob(jobId: string): Promise<ProductionJob> {
  return fetchJson(`/v1/production/jobs/${jobId}/cancel`, parseProductionJob, {
    method: "POST"
  });
}

export async function listResearch(companyId?: string): Promise<ResearchNode[]> {
  const params = new URLSearchParams();
  if (companyId) {
    params.set("companyId", companyId);
  }
  const query = params.toString();

  return fetchJson(`/v1/research${query ? `?${query}` : ""}`, (value) => {
    if (!isRecord(value)) {
      throw new Error("Invalid research list payload");
    }
    return readArray(value.nodes, "nodes").map(parseResearchNode);
  });
}

export async function startResearchNode(nodeId: string, companyId?: string): Promise<ResearchJob> {
  return fetchJson(`/v1/research/${nodeId}/start`, parseResearchJob, {
    method: "POST",
    body: JSON.stringify(companyId ? { companyId } : {})
  });
}

export async function cancelResearchNode(nodeId: string, companyId?: string): Promise<ResearchJob> {
  return fetchJson(`/v1/research/${nodeId}/cancel`, parseResearchJob, {
    method: "POST",
    body: JSON.stringify(companyId ? { companyId } : {})
  });
}

export async function listContracts(
  filters: ListContractsFilters = {}
): Promise<ContractRecord[]> {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.itemId) {
    params.set("itemId", filters.itemId);
  }
  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }

  const query = params.toString();
  return fetchJson(`/v1/contracts${query ? `?${query}` : ""}`, (value) =>
    readArray(value, "contracts").map(parseContractRecord)
  );
}

export async function acceptContract(
  contractId: string,
  sellerCompanyId: string
): Promise<ContractRecord> {
  return fetchJson(`/v1/contracts/${contractId}/accept`, parseContractRecord, {
    method: "POST",
    body: JSON.stringify({ sellerCompanyId })
  });
}

export async function fulfillContract(
  contractId: string,
  sellerCompanyId: string,
  quantity: number
): Promise<ContractFulfillmentResult> {
  return fetchJson(`/v1/contracts/${contractId}/fulfill`, parseContractFulfillmentResult, {
    method: "POST",
    body: JSON.stringify({ sellerCompanyId, quantity })
  });
}

export async function listFinanceLedger(
  filters: FinanceLedgerFilters
): Promise<FinanceLedgerResult> {
  const params = new URLSearchParams();
  params.set("companyId", filters.companyId);

  if (filters.fromTick !== undefined) {
    params.set("fromTick", String(filters.fromTick));
  }
  if (filters.toTick !== undefined) {
    params.set("toTick", String(filters.toTick));
  }
  if (filters.entryType) {
    params.set("entryType", filters.entryType);
  }
  if (filters.referenceType) {
    params.set("referenceType", filters.referenceType);
  }
  if (filters.referenceId) {
    params.set("referenceId", filters.referenceId);
  }
  if (filters.limit !== undefined) {
    params.set("limit", String(filters.limit));
  }
  if (filters.cursor) {
    params.set("cursor", filters.cursor);
  }

  return fetchJson(`/v1/finance/ledger?${params.toString()}`, (value) => {
    if (!isRecord(value)) {
      throw new Error("Invalid finance ledger payload");
    }

    const nextCursorRaw = value.nextCursor;
    const nextCursor =
      nextCursorRaw === null || nextCursorRaw === undefined
        ? null
        : readString(nextCursorRaw, "nextCursor");

    return {
      entries: readArray(value.entries, "entries").map(parseFinanceLedgerEntry),
      nextCursor
    };
  });
}

export async function getFinanceSummary(
  companyId: string,
  windowTicks = 100
): Promise<FinanceSummary> {
  const params = new URLSearchParams();
  params.set("companyId", companyId);
  params.set("windowTicks", String(windowTicks));

  return fetchJson(`/v1/finance/summary?${params.toString()}`, parseFinanceSummary);
}

export async function advanceWorld(ticks: number): Promise<WorldTickState> {
  return fetchJson("/v1/world/advance", parseWorldTickState, {
    method: "POST",
    body: JSON.stringify({ ticks })
  });
}

export async function resetWorld(reseed = true): Promise<WorldTickState> {
  return fetchJson(`/v1/world/reset?reseed=${reseed ? "true" : "false"}`, parseWorldTickState, {
    method: "POST",
    body: JSON.stringify({ reseed })
  });
}

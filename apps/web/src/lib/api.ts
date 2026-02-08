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

export async function getWorldHealth(): Promise<WorldHealth> {
  return fetchJson("/v1/world/health", parseWorldHealth);
}

export async function listCompanies(): Promise<CompanySummary[]> {
  return fetchJson("/v1/companies", (value) =>
    readArray(value, "companies").map(parseCompanySummary)
  );
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

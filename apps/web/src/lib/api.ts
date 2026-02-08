export const HEALTH_POLL_INTERVAL_MS = 3_000;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

type JsonRecord = Record<string, unknown>;

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
  name: string;
  isBot: boolean;
  cashCents: string;
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

async function fetchJson<T>(
  path: string,
  parser: (value: unknown) => T,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    if (isRecord(payload) && typeof payload.message === "string") {
      throw new Error(payload.message);
    }
    throw new Error(`Request failed: ${response.status}`);
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
    name: readString(value.name, "name"),
    isBot: readBoolean(value.isBot, "isBot"),
    cashCents: readString(value.cashCents, "cashCents")
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
    tickClosed:
      tickClosedValue === null ? null : readNumber(tickClosedValue, "tickClosed"),
    createdAt: readString(value.createdAt, "createdAt"),
    updatedAt: readString(value.updatedAt, "updatedAt"),
    closedAt: readNullableString(value.closedAt, "closedAt")
  };
}

function parseMarketOrders(value: unknown): MarketOrder[] {
  return readArray(value, "marketOrders").map(parseMarketOrder);
}

export async function getWorldHealth(): Promise<WorldHealth> {
  return fetchJson("/v1/world/health", parseWorldHealth);
}

export async function listCompanies(): Promise<CompanySummary[]> {
  return fetchJson("/v1/companies", (value) =>
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

export async function advanceWorld(ticks: number): Promise<WorldTickState> {
  return fetchJson(
    "/v1/world/advance",
    parseWorldTickState,
    {
      method: "POST",
      body: JSON.stringify({ ticks })
    }
  );
}

export async function resetWorld(reseed = true): Promise<WorldTickState> {
  return fetchJson(
    `/v1/world/reset?reseed=${reseed ? "true" : "false"}`,
    parseWorldTickState,
    {
      method: "POST",
      body: JSON.stringify({ reseed })
    }
  );
}

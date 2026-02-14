import type {
  CompanyWorkforce,
  CompanyDetails,
  CompanySummary,
  ContractFulfillmentResult,
  ContractRecord,
  CreateProductionJobInput,
  CreateShipmentInput,
  FinanceLedgerFilters,
  FinanceLedgerResult,
  FinanceSummary,
  InventoryRow,
  ItemCatalogItem,
  ListContractsFilters,
  ListShipmentsFilters,
  MarketAnalyticsSummary,
  MarketCandle,
  MarketCandleFilters,
  MarketOrder,
  MarketOrderFilters,
  MarketTrade,
  MarketTradeFilters,
  PlaceMarketOrderInput,
  PlayerIdentity,
  PlayerRegistryEntry,
  ProductionJob,
  ProductionJobFilters,
  ProductionRecipe,
  RegionSummary,
  ResearchJob,
  ResearchNode,
  RequestWorkforceCapacityChangeInput,
  SetWorkforceAllocationInput,
  ShipmentRecord,
  WorkforceCapacityChangeResult,
  WorldHealth,
  WorldTickState
} from "@corpsim/shared";
import { fetchJson, isRecord, readArray, readString } from "./api-client";
import {
  CachedRequestOptions,
  getCachedRequest,
  invalidateCachedRequest,
  invalidateCachedRequestPrefix
} from "./request-cache";
import {
  parseCompanyDetails,
  parseCompanyWorkforce,
  parseCompanySummary,
  parseContractFulfillmentResult,
  parseContractRecord,
  parseFinanceLedgerEntry,
  parseFinanceSummary,
  parseInventoryRow,
  parseItemCatalogItem,
  parseMarketAnalyticsSummary,
  parseMarketCandle,
  parseMarketOrder,
  parseMarketOrders,
  parseMarketTrade,
  parsePlayerIdentity,
  parsePlayerRegistryEntry,
  parseProductionJob,
  parseProductionRecipe,
  parseRegionSummary,
  parseResearchJob,
  parseResearchNode,
  parseShipmentRecord,
  parseWorkforceCapacityChangeResult,
  parseWorldHealth,
  parseWorldTickState
} from "./api-parsers";

export { ApiClientError, HEALTH_POLL_INTERVAL_MS } from "./api-client";
export type * from "@corpsim/shared";

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1_000;
const RESEARCH_CACHE_TTL_MS = 1_000;
const COMPANY_RECIPES_CACHE_TTL_MS = 2_000;

const ITEMS_CACHE_KEY = "catalog:items";
const REGIONS_CACHE_KEY = "catalog:regions";
const RECIPES_CACHE_KEY_PREFIX = "catalog:production-recipes:";
const RESEARCH_CACHE_KEY_PREFIX = "research:";

function resolveRecipesCacheKey(companyId?: string): string {
  return `${RECIPES_CACHE_KEY_PREFIX}${companyId ?? "all"}`;
}

function resolveResearchCacheKey(companyId?: string): string {
  return `${RESEARCH_CACHE_KEY_PREFIX}${companyId ?? "default"}`;
}

function invalidateStaticCatalogCaches(): void {
  invalidateCachedRequest(ITEMS_CACHE_KEY);
  invalidateCachedRequest(REGIONS_CACHE_KEY);
  invalidateCachedRequestPrefix(RECIPES_CACHE_KEY_PREFIX);
}

function invalidateResearchCaches(): void {
  invalidateCachedRequestPrefix(RESEARCH_CACHE_KEY_PREFIX);
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

export async function getCompanyWorkforce(companyId: string): Promise<CompanyWorkforce> {
  const params = new URLSearchParams();
  params.set("companyId", companyId);
  return fetchJson(`/v1/company/workforce?${params.toString()}`, parseCompanyWorkforce);
}

export async function setCompanyWorkforceAllocation(
  input: SetWorkforceAllocationInput
): Promise<CompanyWorkforce> {
  return fetchJson("/v1/company/workforce/allocation", parseCompanyWorkforce, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function requestCompanyWorkforceCapacityChange(
  input: RequestWorkforceCapacityChangeInput
): Promise<WorkforceCapacityChangeResult> {
  return fetchJson(
    "/v1/company/workforce/capacity-change",
    parseWorkforceCapacityChangeResult,
    {
      method: "POST",
      body: JSON.stringify(input)
    }
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

export async function listPlayerRegistry(): Promise<PlayerRegistryEntry[]> {
  return fetchJson("/v1/players/registry", (value) =>
    readArray(value, "players").map(parsePlayerRegistryEntry)
  );
}

export async function listCompanyInventory(
  companyId: string,
  regionId?: string
): Promise<InventoryRow[]> {
  const params = new URLSearchParams();
  if (regionId) {
    params.set("regionId", regionId);
  }
  const query = params.toString();

  return fetchJson(`/v1/companies/${companyId}/inventory${query ? `?${query}` : ""}`, (value) =>
    readArray(value, "inventory").map(parseInventoryRow)
  );
}

export async function listRegions(options?: CachedRequestOptions): Promise<RegionSummary[]> {
  return getCachedRequest(
    REGIONS_CACHE_KEY,
    CATALOG_CACHE_TTL_MS,
    () => fetchJson("/v1/regions", (value) => readArray(value, "regions").map(parseRegionSummary)),
    options
  );
}

export async function listShipments(filters: ListShipmentsFilters = {}): Promise<ShipmentRecord[]> {
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
  return fetchJson(`/v1/shipments${query ? `?${query}` : ""}`, (value) =>
    readArray(value, "shipments").map(parseShipmentRecord)
  );
}

export async function createShipment(input: CreateShipmentInput): Promise<ShipmentRecord> {
  return fetchJson("/v1/shipments", parseShipmentRecord, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function cancelShipment(shipmentId: string): Promise<ShipmentRecord> {
  return fetchJson(`/v1/shipments/${shipmentId}/cancel`, parseShipmentRecord, {
    method: "POST"
  });
}

export async function listMarketOrders(filters: MarketOrderFilters): Promise<MarketOrder[]> {
  const params = new URLSearchParams();
  if (filters.itemId) {
    params.set("itemId", filters.itemId);
  }
  if (filters.regionId) {
    params.set("regionId", filters.regionId);
  }
  if (filters.side) {
    params.set("side", filters.side);
  }
  if (filters.status) {
    params.set("status", filters.status);
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
  if (filters.regionId) {
    params.set("regionId", filters.regionId);
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
  params.set("regionId", filters.regionId);

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
  regionId: string,
  windowTicks = 200
): Promise<MarketAnalyticsSummary> {
  const params = new URLSearchParams();
  params.set("itemId", itemId);
  params.set("regionId", regionId);
  params.set("windowTicks", String(windowTicks));

  return fetchJson(`/v1/market/analytics/summary?${params.toString()}`, parseMarketAnalyticsSummary);
}

export async function listItems(options?: CachedRequestOptions): Promise<ItemCatalogItem[]> {
  return getCachedRequest(
    ITEMS_CACHE_KEY,
    CATALOG_CACHE_TTL_MS,
    () => fetchJson("/v1/items", (value) => readArray(value, "items").map(parseItemCatalogItem)),
    options
  );
}

export async function listProductionRecipes(
  companyId?: string,
  options?: CachedRequestOptions
): Promise<ProductionRecipe[]> {
  const params = new URLSearchParams();
  if (companyId) {
    params.set("companyId", companyId);
  }
  const query = params.toString();
  const path = `/v1/production/recipes${query ? `?${query}` : ""}`;

  const ttl = companyId ? COMPANY_RECIPES_CACHE_TTL_MS : CATALOG_CACHE_TTL_MS;
  return getCachedRequest(
    resolveRecipesCacheKey(companyId),
    ttl,
    () =>
      fetchJson(path, (value) =>
        readArray(value, "recipes").map(parseProductionRecipe)
      ),
    options
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

export async function listResearch(
  companyId?: string,
  options?: CachedRequestOptions
): Promise<ResearchNode[]> {
  const params = new URLSearchParams();
  if (companyId) {
    params.set("companyId", companyId);
  }
  const query = params.toString();
  const path = `/v1/research${query ? `?${query}` : ""}`;

  return getCachedRequest(
    resolveResearchCacheKey(companyId),
    RESEARCH_CACHE_TTL_MS,
    () =>
      fetchJson(path, (value) => {
        if (!isRecord(value)) {
          throw new Error("Invalid research list payload");
        }
        return readArray(value.nodes, "nodes").map(parseResearchNode);
      }),
    options
  );
}

export async function startResearchNode(nodeId: string, companyId?: string): Promise<ResearchJob> {
  const result = await fetchJson(`/v1/research/${nodeId}/start`, parseResearchJob, {
    method: "POST",
    body: JSON.stringify(companyId ? { companyId } : {})
  });
  invalidateResearchCaches();
  return result;
}

export async function cancelResearchNode(nodeId: string, companyId?: string): Promise<ResearchJob> {
  const result = await fetchJson(`/v1/research/${nodeId}/cancel`, parseResearchJob, {
    method: "POST",
    body: JSON.stringify(companyId ? { companyId } : {})
  });
  invalidateResearchCaches();
  return result;
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
  const result = await fetchJson(
    `/v1/world/reset?reseed=${reseed ? "true" : "false"}`,
    parseWorldTickState,
    {
      method: "POST",
      body: JSON.stringify({ reseed })
    }
  );

  invalidateStaticCatalogCaches();
  invalidateResearchCaches();
  return result;
}

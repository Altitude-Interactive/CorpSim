import type { CompanySpecialization, ItemCategory } from "./company-specialization";

// Shared API contracts used by both API and web.

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
  specialization: CompanySpecialization;
  cashCents: string;
  regionId: string;
  regionCode: string;
  regionName: string;
}

export interface CompanyDetails extends CompanySummary {
  reservedCashCents: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySpecializationOption {
  code: CompanySpecialization;
  label: string;
  description: string;
  unlockedCategories: ItemCategory[];
  sampleItemCodes: string[];
}

export interface PlayerIdentity {
  id: string;
  handle: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerRegistryItemHolding {
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  reservedQuantity: number;
}

export interface PlayerRegistryCompany {
  id: string;
  code: string;
  name: string;
  isBot: boolean;
  cashCents: string;
  regionId: string;
  regionCode: string;
  regionName: string;
  itemHoldings: PlayerRegistryItemHolding[];
}

export interface PlayerRegistryEntry {
  id: string;
  handle: string;
  createdAt: string;
  updatedAt: string;
  companies: PlayerRegistryCompany[];
}

export interface InventoryRow {
  itemId: string;
  regionId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  reservedQuantity: number;
}

export interface RegionSummary {
  id: string;
  code: string;
  name: string;
}

export interface ShipmentRecord {
  id: string;
  companyId: string;
  fromRegionId: string;
  toRegionId: string;
  itemId: string;
  quantity: number;
  status: "IN_TRANSIT" | "DELIVERED" | "CANCELLED";
  tickCreated: number;
  tickArrives: number;
  tickClosed: number | null;
  createdAt: string;
  updatedAt: string;
  item: {
    id: string;
    code: string;
    name: string;
  };
  fromRegion: RegionSummary;
  toRegion: RegionSummary;
}

export interface ListShipmentsFilters {
  companyId?: string;
  status?: ShipmentRecord["status"];
  limit?: number;
}

export interface CreateShipmentInput {
  companyId: string;
  toRegionId: string;
  itemId: string;
  quantity: number;
}

export interface MarketOrder {
  id: string;
  companyId: string;
  itemId: string;
  regionId: string;
  side: "BUY" | "SELL";
  status: MarketOrderStatus;
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

export type MarketOrderStatus = "OPEN" | "FILLED" | "CANCELLED";

export interface MarketOrderFilters {
  itemId?: string;
  regionId?: string;
  side?: "BUY" | "SELL";
  status?: MarketOrderStatus;
  companyId?: string;
  limit?: number;
}

export interface MarketTrade {
  id: string;
  tick: number;
  itemId: string;
  regionId: string;
  buyerId: string;
  sellerId: string;
  priceCents: string;
  quantity: number;
  createdAt: string;
}

export interface MarketTradeFilters {
  itemId?: string;
  regionId?: string;
  companyId?: string;
  limit?: number;
}

export interface MarketCandle {
  id: string;
  itemId: string;
  regionId: string;
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
  regionId: string;
  fromTick?: number;
  toTick?: number;
  limit?: number;
}

export interface MarketAnalyticsSummary {
  itemId: string;
  regionId: string;
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
  regionId?: string;
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
  | "SHIPMENT_FEE"
  | "RESEARCH_PAYMENT"
  | "PRODUCTION_COMPLETION"
  | "PRODUCTION_COST"
  | "WORKFORCE_SALARY_EXPENSE"
  | "WORKFORCE_RECRUITMENT_EXPENSE"
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

export interface WorkforceProjectedModifiers {
  productionSpeedBonusBps: number;
  productionDurationMultiplierBps: number;
  researchSpeedBonusBps: number;
  researchDurationMultiplierBps: number;
  logisticsTravelReductionBps: number;
  logisticsTravelMultiplierBps: number;
}

export interface WorkforcePendingHiringArrival {
  id: string;
  deltaCapacity: number;
  tickArrives: number;
  createdAt: string;
}

export interface CompanyWorkforce {
  companyId: string;
  workforceCapacity: number;
  workforceAllocationOpsPct: number;
  workforceAllocationRngPct: number;
  workforceAllocationLogPct: number;
  workforceAllocationCorpPct: number;
  orgEfficiencyBps: number;
  weeklySalaryBurnCents: string;
  projectedModifiers: WorkforceProjectedModifiers;
  pendingHiringArrivals: WorkforcePendingHiringArrival[];
  updatedAt: string;
}

export interface SetWorkforceAllocationInput {
  companyId: string;
  operationsPct: number;
  researchPct: number;
  logisticsPct: number;
  corporatePct: number;
}

export interface RequestWorkforceCapacityChangeInput {
  companyId: string;
  deltaCapacity: number;
}

export interface WorkforceCapacityChangeResult {
  companyId: string;
  deltaCapacity: number;
  appliedImmediately: boolean;
  tickRequested: number;
  tickArrives: number | null;
  recruitmentCostCents: string;
  workforceCapacity: number;
  orgEfficiencyBps: number;
}

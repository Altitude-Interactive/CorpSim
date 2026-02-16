export type UiStatusLevel = "green" | "yellow" | "red";

export const UI_COPY = {
  modules: {
    overview: "Overview",
    market: "Market",
    production: "Production",
    research: "Research",
    workforce: "Workforce",
    inventory: "Inventory",
    logistics: "Logistics",
    contracts: "Contracts",
    finance: "Finance",
    analytics: "Analytics",
    world: "World Status",
    admin: "Admin"
  },
  common: {
    noCompanySelected: "No company selected",
    selectCompanyFirst: "Select a company before continuing.",
    unknownRegion: "Unknown region",
    unknownItem: "Unknown item",
    unknownCompany: "Unknown company",
    unknownReference: "Reference hidden",
    reference: "Reference",
    referenceCopied: "Reference copied to clipboard.",
    unavailableForCompany: "This action is unavailable for the selected company.",
    dataChangedRetry: "Data changed while processing. Refresh and try again.",
    recordNotFound: "The requested record could not be found."
  },
  status: {
    labelPrefix: "System status",
    levels: {
      green: {
        label: "Operational",
        description: "Live data is updating normally."
      },
      yellow: {
        label: "Degraded",
        description: "Updates are delayed. Showing the latest confirmed snapshot."
      },
      red: {
        label: "Offline",
        description: "Live data is currently unavailable."
      }
    }
  },
  world: {
    title: "World Status",
    subtitle: "Operational summary of the simulation environment.",
    lastSimulationRun: "Last simulation run",
    nextExpectedWeek: "Next expected week",
    refresh: "Refresh status",
    diagnostics: {
      title: "Diagnostics",
      toggleLabel: "Enable diagnostics mode",
      hint: "Use diagnostics for internal troubleshooting details.",
      controlsTitle: "Simulation Controls",
      advance: "Advance Weeks",
      reset: "Reset + Reseed"
    },
    integrity: {
      title: "System Integrity",
      healthy: "All checks passed",
      violations: "Issues detected",
      unavailable: "Integrity status is unavailable right now.",
      partial: "Partial results",
      complete: "Full results"
    },
    errors: {
      syncIssueTitle: "Status refresh delayed",
      syncIssueDescription:
        "The latest snapshot could not be refreshed. You can keep working with the last successful data.",
      schemaBlockedTitle: "Game loading is paused",
      schemaBlockedDescription:
        "A database update is required before the game can load. Apply updates and try again.",
      schemaCheckFailedDescription:
        "The system could not confirm database readiness. Resolve database issues and try again.",
      schemaRetry: "Check again",
      schemaPendingUpdates: "Pending updates",
      schemaFailedUpdates: "Failed updates",
      schemaUnexpectedUpdates: "Unexpected updates"
    }
  },
  help: {
    reservedCash: "Cash reserved for active orders and commitments.",
    tradesLast100: "Count of the most recent 100 trade records.",
    regionScope: "Region affects inventory location, logistics routes, and market scope."
  },
  finance: {
    entryCategory: "Transaction category",
    allEntryCategories: "All transaction categories",
    referenceCategory: "Reference category",
    referenceContains: "Reference contains...",
    rowLimit: "Row limit (default 100, max 500)",
    windowSize: "Window size (weeks)"
  },
  documentation: {
    navLabel: "ERP Documentation",
    title: "ERP Documentation",
    description:
      "Access operating procedures, module guides, and business process references for CorpSim ERP.",
    openCta: "Open Documentation",
    baseUrl: "https://docs.altitude-interactive.com/corpsim",
    routePaths: {
      "/overview": "/pages/overview",
      "/market": "/pages/market",
      "/production": "/pages/production",
      "/research": "/pages/research",
      "/workforce": "/pages/workforce",
      "/inventory": "/pages/inventory",
      "/logistics": "/pages/logistics",
      "/contracts": "/pages/contracts",
      "/finance": "/pages/finance",
      "/analytics": "/pages/analytics",
      "/world": "/pages/world-status"
    }
  }
} as const;

interface RegionCopy {
  label: string;
  description: string;
}

const REGION_COPY_BY_CODE: Record<string, RegionCopy> = {
  CORE: {
    label: "Central Exchange",
    description: "Balanced demand, reliable suppliers, and broad trading access."
  },
  INDUSTRIAL: {
    label: "Manufacturing District",
    description: "Production-heavy corridor with deep fabrication capacity."
  },
  FRONTIER: {
    label: "Frontier Corridor",
    description: "Emerging market with wider price swings and route upside."
  }
};

const REGION_ALIAS_TO_CODE: Record<string, keyof typeof REGION_COPY_BY_CODE> = {
  CORE: "CORE",
  CORE_REGION: "CORE",
  CENTRAL_EXCHANGE: "CORE",
  INDUSTRIAL: "INDUSTRIAL",
  INDUSTRIAL_REGION: "INDUSTRIAL",
  MANUFACTURING_DISTRICT: "INDUSTRIAL",
  FRONTIER: "FRONTIER",
  FRONTIER_REGION: "FRONTIER",
  FRONTIER_CORRIDOR: "FRONTIER"
};

export interface RegionLike {
  code?: string | null;
  name?: string | null;
}

function titleCaseFromCode(code: string): string {
  return code
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function normalizeRegionToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveRegionCopy(region: RegionLike | null | undefined): RegionCopy | null {
  const nameToken = region?.name ? normalizeRegionToken(region.name) : "";
  const codeToken = region?.code ? normalizeRegionToken(region.code) : "";

  const canonicalCode =
    REGION_ALIAS_TO_CODE[nameToken] ??
    REGION_ALIAS_TO_CODE[codeToken] ??
    (REGION_COPY_BY_CODE[codeToken] ? (codeToken as keyof typeof REGION_COPY_BY_CODE) : undefined);

  if (!canonicalCode) {
    return null;
  }

  return REGION_COPY_BY_CODE[canonicalCode];
}

export function getRegionLabel(region: RegionLike | null | undefined): string {
  if (!region) {
    return UI_COPY.common.unknownRegion;
  }

  const mapped = resolveRegionCopy(region);
  if (mapped) {
    return mapped.label;
  }

  const name = region.name?.trim();
  if (name) {
    return name;
  }

  const code = region.code?.trim().toUpperCase();
  if (!code) {
    return UI_COPY.common.unknownRegion;
  }

  return REGION_COPY_BY_CODE[code]?.label ?? titleCaseFromCode(code);
}

export function getRegionDescription(region: RegionLike | null | undefined): string | null {
  return resolveRegionCopy(region)?.description ?? null;
}

export function getSystemStatusCopy(status: UiStatusLevel) {
  return UI_COPY.status.levels[status];
}

export function getDocumentationUrl(route?: string | null): string {
  const baseUrl = UI_COPY.documentation.baseUrl;
  if (!route) {
    return baseUrl;
  }

  const docsPath = UI_COPY.documentation.routePaths[route as keyof typeof UI_COPY.documentation.routePaths];
  return docsPath ? `${baseUrl}${docsPath}` : baseUrl;
}

const CODE_LABEL_OVERRIDES: Record<string, string> = {
  BUY: "Buy",
  SELL: "Sell",
  OPEN: "Open",
  FILLED: "Filled",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  RUNNING: "Running",
  AVAILABLE: "Available",
  LOCKED: "Locked",
  RESEARCHING: "In progress",
  ACCEPTED: "Accepted",
  PARTIALLY_FULFILLED: "Partially fulfilled",
  FULFILLED: "Fulfilled",
  EXPIRED: "Expired",
  IN_TRANSIT: "In transit",
  DELIVERED: "Delivered",
  ORDER_RESERVE: "Order reserve",
  TRADE_SETTLEMENT: "Trade settlement",
  CONTRACT_SETTLEMENT: "Contract settlement",
  RESEARCH_PAYMENT: "Research payment",
  PRODUCTION_COMPLETION: "Production completion",
  PRODUCTION_COST: "Production cost",
  WORKFORCE_SALARY_EXPENSE: "Workforce salary expense",
  WORKFORCE_RECRUITMENT_EXPENSE: "Workforce recruitment expense",
  MANUAL_ADJUSTMENT: "Manual adjustment"
};

export function formatCodeLabel(value: string): string {
  const code = value.trim().toUpperCase();
  if (!code) {
    return value;
  }

  const overridden = CODE_LABEL_OVERRIDES[code];
  if (overridden) {
    return overridden;
  }

  return code
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

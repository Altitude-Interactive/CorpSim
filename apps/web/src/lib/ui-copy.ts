export type UiStatusLevel = "green" | "yellow" | "red";

export const UI_COPY = {
  modules: {
    overview: "Overview",
    market: "Market",
    production: "Production",
    research: "Research",
    inventory: "Inventory",
    logistics: "Logistics",
    contracts: "Contracts",
    finance: "Finance",
    analytics: "Analytics",
    world: "World Status"
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
        "The latest snapshot could not be refreshed. You can keep working with the last successful data."
    }
  },
  help: {
    reservedCash: "Cash reserved for active orders and commitments.",
    tradesLast100: "Count of the most recent 100 trade records.",
    regionScope: "Region affects inventory location, logistics routes, and market scope."
  }
} as const;

interface RegionCopy {
  label: string;
  description: string;
}

const REGION_COPY_BY_CODE: Record<string, RegionCopy> = {
  CORE: {
    label: "Core Region",
    description: "Balanced market access with stable supply and demand."
  },
  INDUSTRIAL: {
    label: "Industrial Region",
    description: "Manufacturing-focused region with strong production throughput."
  },
  FRONTIER: {
    label: "Frontier Region",
    description: "Emerging region with higher volatility and route opportunities."
  }
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

export function getRegionLabel(region: RegionLike | null | undefined): string {
  if (!region) {
    return "Unknown region";
  }

  const name = region.name?.trim();
  if (name) {
    const mappedFromName = REGION_COPY_BY_CODE[name.toUpperCase()];
    if (mappedFromName) {
      return mappedFromName.label;
    }
    return name;
  }

  const code = region.code?.trim().toUpperCase();
  if (!code) {
    return "Unknown region";
  }

  return REGION_COPY_BY_CODE[code]?.label ?? titleCaseFromCode(code);
}

export function getRegionDescription(region: RegionLike | null | undefined): string | null {
  const name = region?.name?.trim().toUpperCase();
  if (name && REGION_COPY_BY_CODE[name]) {
    return REGION_COPY_BY_CODE[name].description;
  }

  const code = region?.code?.trim().toUpperCase();
  if (!code) {
    return null;
  }

  return REGION_COPY_BY_CODE[code]?.description ?? null;
}

export function getSystemStatusCopy(status: UiStatusLevel) {
  return UI_COPY.status.levels[status];
}

import { UI_COPY } from "./ui-copy";

export interface AppPageNavigationItem {
  href: string;
  label: string;
  keywords: string[];
  showInSidebar: boolean;
}

export const APP_PAGE_NAVIGATION: AppPageNavigationItem[] = [
  {
    href: "/overview",
    label: UI_COPY.modules.overview,
    keywords: ["dashboard", "home", "summary"],
    showInSidebar: true
  },
  {
    href: "/market",
    label: UI_COPY.modules.market,
    keywords: ["orders", "trades", "exchange"],
    showInSidebar: true
  },
  {
    href: "/production",
    label: UI_COPY.modules.production,
    keywords: ["recipes", "factory", "manufacturing"],
    showInSidebar: true
  },
  {
    href: "/research",
    label: UI_COPY.modules.research,
    keywords: ["technology", "nodes", "unlocks"],
    showInSidebar: true
  },
  {
    href: "/workforce",
    label: UI_COPY.modules.workforce,
    keywords: ["staff", "allocation", "capacity"],
    showInSidebar: true
  },
  {
    href: "/inventory",
    label: UI_COPY.modules.inventory,
    keywords: ["stock", "storage", "items"],
    showInSidebar: true
  },
  {
    href: "/logistics",
    label: UI_COPY.modules.logistics,
    keywords: ["shipments", "routes", "delivery"],
    showInSidebar: true
  },
  {
    href: "/contracts",
    label: UI_COPY.modules.contracts,
    keywords: ["deals", "buyer", "seller"],
    showInSidebar: true
  },
  {
    href: "/finance",
    label: UI_COPY.modules.finance,
    keywords: ["ledger", "cash", "transactions"],
    showInSidebar: true
  },
  {
    href: "/analytics",
    label: UI_COPY.modules.analytics,
    keywords: ["metrics", "trends", "reports"],
    showInSidebar: true
  },
  {
    href: "/world",
    label: UI_COPY.modules.world,
    keywords: ["status", "simulation", "health"],
    showInSidebar: true
  },
  {
    href: "/players/catalog",
    label: "Player Registry",
    keywords: ["players", "registry", "catalog"],
    showInSidebar: false
  },
  {
    href: "/dev/catalog",
    label: "Developer Catalog",
    keywords: ["developer", "dev", "catalog"],
    showInSidebar: false
  }
];

export const SIDEBAR_PAGE_NAVIGATION = APP_PAGE_NAVIGATION.filter(
  (entry) => entry.showInSidebar
);

export const COMMAND_PAGE_NAVIGATION = APP_PAGE_NAVIGATION;

export const TOP_BAR_TITLES: Record<string, string> = APP_PAGE_NAVIGATION.reduce(
  (accumulator, entry) => {
    accumulator[entry.href] = entry.label;
    return accumulator;
  },
  {} as Record<string, string>
);

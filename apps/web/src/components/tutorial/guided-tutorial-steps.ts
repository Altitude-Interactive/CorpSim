export interface GuidedTutorialStep {
  route: string;
  targetId: string;
  title: string;
  description: string;
}

export const GUIDED_TUTORIAL_STEPS: GuidedTutorialStep[] = [
  {
    route: "/overview",
    targetId: "overview-company",
    title: "Confirm your active company",
    description:
      "This card shows your current company context. These values are company-specific."
  },
  {
    route: "/overview",
    targetId: "overview-kpis",
    title: "Read the world pulse",
    description:
      "These metrics summarize the full simulation (all companies), not just your company."
  },
  {
    route: "/overview",
    targetId: "overview-integrity",
    title: "Watch system integrity",
    description: "If there are issues here, investigate before scaling operations."
  },
  {
    route: "/market",
    targetId: "market-order-placement",
    title: "Place buy and sell orders",
    description: "This is where you create market orders for the active company."
  },
  {
    route: "/market",
    targetId: "market-order-book",
    title: "Read the order book",
    description: "Use this table to inspect current prices, quantity, and market depth."
  },
  {
    route: "/production",
    targetId: "production-start",
    title: "Start production runs",
    description: "Pick a recipe and quantity, then launch jobs from this panel."
  },
  {
    route: "/production",
    targetId: "production-recipes",
    title: "Review recipes first",
    description: "Check output, duration, and required inputs before committing runs."
  },
  {
    route: "/inventory",
    targetId: "inventory-filters",
    title: "Filter your inventory view",
    description: "Search and region filters help you focus the exact stock you need."
  },
  {
    route: "/inventory",
    targetId: "inventory-table",
    title: "Track available stock",
    description: "Use quantity, reserved, and available values to avoid production stalls."
  }
];

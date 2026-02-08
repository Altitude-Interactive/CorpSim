"use client";

import { RefreshCcw } from "lucide-react";
import { usePathname } from "next/navigation";
import { ActiveCompanyCombobox } from "@/components/company/active-company-combobox";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "./status-indicator";
import { useWorldHealth } from "./world-health-provider";

const TITLES: Record<string, string> = {
  "/overview": "Overview",
  "/market": "Market",
  "/inventory": "Inventory",
  "/world": "World"
};

function formatTickLabel(currentTick: number | undefined) {
  if (currentTick === undefined) {
    return "Tick --";
  }
  return `Tick ${currentTick.toLocaleString()}`;
}

export function TopBar() {
  const pathname = usePathname();
  const { health, apiStatus, refresh, isRefreshing } = useWorldHealth();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">{TITLES[pathname] ?? "CorpSim"}</h1>
          <p className="text-xs text-muted-foreground">{formatTickLabel(health?.currentTick)}</p>
        </div>
        <div className="flex items-center gap-3">
          <ActiveCompanyCombobox />
          <StatusIndicator status={apiStatus} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={isRefreshing}
          >
            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>
      </div>
    </header>
  );
}

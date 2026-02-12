"use client";

import { BookOpenText, RefreshCcw } from "lucide-react";
import { usePathname } from "next/navigation";
import { ActiveCompanyCombobox } from "@/components/company/active-company-combobox";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineHelp } from "@/components/ui/inline-help";
import { formatCadencePoint } from "@/lib/ui-terms";
import { getDocumentationUrl, getRegionDescription, getRegionLabel, UI_COPY } from "@/lib/ui-copy";
import { StatusIndicator } from "./status-indicator";
import { useWorldHealth } from "./world-health-provider";

const TITLES: Record<string, string> = {
  "/overview": UI_COPY.modules.overview,
  "/market": UI_COPY.modules.market,
  "/production": UI_COPY.modules.production,
  "/research": UI_COPY.modules.research,
  "/inventory": UI_COPY.modules.inventory,
  "/logistics": UI_COPY.modules.logistics,
  "/contracts": UI_COPY.modules.contracts,
  "/finance": UI_COPY.modules.finance,
  "/analytics": UI_COPY.modules.analytics,
  "/world": UI_COPY.modules.world
};

export function TopBar() {
  const pathname = usePathname();
  const { health, apiStatus, refresh, isRefreshing } = useWorldHealth();
  const { activeCompany } = useActiveCompany();
  const regionLabel = getRegionLabel({
    code: activeCompany?.regionCode,
    name: activeCompany?.regionName
  });
  const regionDescription = getRegionDescription({
    code: activeCompany?.regionCode
  });
  const regionHelpText = regionDescription
    ? `${regionDescription} ${UI_COPY.help.regionScope}`
    : UI_COPY.help.regionScope;

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <h1 className="text-base font-semibold">{TITLES[pathname] ?? "CorpSim"}</h1>
          <p className="text-xs text-muted-foreground">{formatCadencePoint(health?.currentTick)}</p>
        </div>
        <div className="flex items-center gap-3">
          <ActiveCompanyCombobox />
          {activeCompany ? (
            <div className="inline-flex items-center gap-1">
              <Badge variant="info" title={regionHelpText}>{`Region: ${regionLabel}`}</Badge>
              <InlineHelp label={regionHelpText} />
            </div>
          ) : null}
          <StatusIndicator status={apiStatus} />
          <Button asChild variant="outline" size="sm">
            <a href={getDocumentationUrl(pathname)} target="_blank" rel="noreferrer">
              <BookOpenText className="mr-2 h-3.5 w-3.5" />
              Docs
            </a>
          </Button>
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

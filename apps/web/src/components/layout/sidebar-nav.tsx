"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  Box,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  Factory,
  FlaskConical,
  Globe,
  LayoutDashboard,
  LineChart,
  PackageSearch,
  Truck,
  TrendingUp,
  Users
} from "lucide-react";
import { getDocumentationUrl, UI_COPY } from "@/lib/ui-copy";
import { cn } from "@/lib/utils";
import { AppVersionBadge } from "./app-version-badge";

const NAV_ITEMS = [
  { href: "/overview", label: UI_COPY.modules.overview, icon: LayoutDashboard },
  { href: "/market", label: UI_COPY.modules.market, icon: TrendingUp },
  { href: "/production", label: UI_COPY.modules.production, icon: Factory },
  { href: "/research", label: UI_COPY.modules.research, icon: FlaskConical },
  { href: "/workforce", label: UI_COPY.modules.workforce, icon: Users },
  { href: "/inventory", label: UI_COPY.modules.inventory, icon: PackageSearch },
  { href: "/logistics", label: UI_COPY.modules.logistics, icon: Truck },
  { href: "/contracts", label: UI_COPY.modules.contracts, icon: ClipboardList },
  { href: "/finance", label: UI_COPY.modules.finance, icon: CircleDollarSign },
  { href: "/analytics", label: UI_COPY.modules.analytics, icon: LineChart },
  { href: "/world", label: UI_COPY.modules.world, icon: Globe }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 flex-col border-r border-border bg-card/80 p-4 lg:flex">
      <div className="mb-8 flex items-center gap-2">
        <div className="rounded-md bg-primary/15 p-2 text-primary">
          <Box className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">CorpSim ERP</p>
          <p className="text-xs text-muted-foreground">Operations Dashboard</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              href={item.href}
              key={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground",
                isActive && "bg-primary/15 text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-3 border-t border-border/70 pt-3">
        <a
          href={getDocumentationUrl()}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <span className="inline-flex items-center gap-2">
            <BookOpenText className="h-4 w-4" />
            <span>{UI_COPY.documentation.navLabel}</span>
          </span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <AppVersionBadge className="px-3 pt-2 text-[11px]" />
      </div>
    </aside>
  );
}

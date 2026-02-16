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
  Shield,
  Truck,
  TrendingUp,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SIDEBAR_PAGE_NAVIGATION, APP_PAGE_NAVIGATION } from "@/lib/page-navigation";
import { getDocumentationUrl, UI_COPY } from "@/lib/ui-copy";
import { cn } from "@/lib/utils";
import { AppVersionBadge } from "./app-version-badge";
import { authClient } from "@/lib/auth-client";
import { useMemo } from "react";

const NAV_ICON_BY_ROUTE: Record<string, LucideIcon> = {
  "/overview": LayoutDashboard,
  "/market": TrendingUp,
  "/production": Factory,
  "/research": FlaskConical,
  "/workforce": Users,
  "/inventory": PackageSearch,
  "/logistics": Truck,
  "/contracts": ClipboardList,
  "/finance": CircleDollarSign,
  "/analytics": LineChart,
  "/world": Globe,
  "/admin": Shield
};

function isAdminRole(role: string | null | undefined): boolean {
  if (!role) {
    return false;
  }
  return role
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === "admin");
}

export function SidebarNav() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  const navigationItems = useMemo(() => {
    const isAdmin = isAdminRole(session?.user?.role);
    
    // Start with regular sidebar navigation
    const items = [...SIDEBAR_PAGE_NAVIGATION];
    
    // Add admin page if user is admin
    if (isAdmin) {
      const adminPage = APP_PAGE_NAVIGATION.find((page) => page.href === "/admin");
      if (adminPage) {
        items.push(adminPage);
      }
    }
    
    return items;
  }, [session?.user?.role]);

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
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = NAV_ICON_BY_ROUTE[item.href];
          if (!Icon) {
            return null;
          }
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

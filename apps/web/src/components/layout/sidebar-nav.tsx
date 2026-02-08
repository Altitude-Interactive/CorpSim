"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Box,
  CircleDollarSign,
  ClipboardList,
  Factory,
  FlaskConical,
  Globe,
  LayoutDashboard,
  LineChart,
  PackageSearch,
  Truck,
  TrendingUp
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/market", label: "Market", icon: TrendingUp },
  { href: "/production", label: "Production", icon: Factory },
  { href: "/research", label: "Research", icon: FlaskConical },
  { href: "/inventory", label: "Inventory", icon: PackageSearch },
  { href: "/logistics", label: "Logistics", icon: Truck },
  { href: "/contracts", label: "Contracts", icon: ClipboardList },
  { href: "/finance", label: "Finance", icon: CircleDollarSign },
  { href: "/analytics", label: "Analytics", icon: LineChart },
  { href: "/world", label: "World", icon: Globe }
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-60 flex-col border-r border-border bg-card/80 p-4 lg:flex">
      <div className="mb-8 flex items-center gap-2">
        <div className="rounded-md bg-primary/15 p-2 text-primary">
          <Box className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">CorpSim ERP</p>
          <p className="text-xs text-muted-foreground">Dark Operations Dashboard</p>
        </div>
      </div>
      <nav className="space-y-1">
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
    </aside>
  );
}

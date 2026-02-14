"use client";

import { usePathname } from "next/navigation";
import { ToastNotice } from "@/components/ui/toast-manager";
import { UI_COPY } from "@/lib/ui-copy";
import { AppVersionBadge } from "./app-version-badge";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import { useWorldHealth } from "./world-health-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { error } = useWorldHealth();
  const isUnsupportedDevicePage = pathname === "/unsupported-device";

  if (isUnsupportedDevicePage) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <SidebarNav />
        <div className="flex min-h-screen flex-1 flex-col">
          <TopBar />
          <main className="flex-1 p-4 lg:p-6">
            {error ? (
              <ToastNotice
                variant="danger"
                className="mb-4"
                title={UI_COPY.world.errors.syncIssueTitle}
                description={UI_COPY.world.errors.syncIssueDescription}
              />
            ) : null}
            <div className="mx-auto w-full max-w-[1320px]">{children}</div>
          </main>
          <footer className="border-t border-border/60 px-4 py-2 lg:hidden">
            <AppVersionBadge className="text-[11px]" />
          </footer>
        </div>
      </div>
    </div>
  );
}

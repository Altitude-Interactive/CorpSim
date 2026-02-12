"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UI_COPY } from "@/lib/ui-copy";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import { useWorldHealth } from "./world-health-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { error } = useWorldHealth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <SidebarNav />
        <div className="flex min-h-screen flex-1 flex-col">
          <TopBar />
          <main className="flex-1 p-4 lg:p-6">
            {error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>{UI_COPY.world.errors.syncIssueTitle}</AlertTitle>
                <AlertDescription>
                  {UI_COPY.world.errors.syncIssueDescription}
                </AlertDescription>
              </Alert>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

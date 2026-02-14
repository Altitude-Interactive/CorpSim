"use client";

import { usePathname } from "next/navigation";
import { ToastNotice } from "@/components/ui/toast-manager";
import { Button } from "@/components/ui/button";
import { UI_COPY } from "@/lib/ui-copy";
import { AppVersionBadge } from "./app-version-badge";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import { useWorldHealth } from "./world-health-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { error, isRefreshing, refresh, schemaReadiness } = useWorldHealth();
  const isUnsupportedDevicePage = pathname === "/unsupported-device";

  if (isUnsupportedDevicePage) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  if (schemaReadiness && !schemaReadiness.ready) {
    const showCheckFailure = schemaReadiness.status === "schema-check-failed";

    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="mx-auto flex min-h-screen w-full max-w-[980px] items-center px-4 py-8 lg:px-6">
          <section className="w-full rounded-xl border border-border/70 bg-card/70 p-6 shadow-sm">
            <h1 className="text-2xl font-semibold tracking-tight">
              {UI_COPY.world.errors.schemaBlockedTitle}
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
              {showCheckFailure
                ? UI_COPY.world.errors.schemaCheckFailedDescription
                : UI_COPY.world.errors.schemaBlockedDescription}
            </p>
            <div className="mt-4 flex gap-3">
              <Button onClick={() => void refresh()} disabled={isRefreshing}>
                {UI_COPY.world.errors.schemaRetry}
              </Button>
            </div>
            {schemaReadiness.issues.length > 0 ? (
              <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
                {schemaReadiness.issues.map((issue) => (
                  <li key={issue}>- {issue}</li>
                ))}
              </ul>
            ) : null}
            {schemaReadiness.pendingMigrations.length > 0 ? (
              <p className="mt-5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {UI_COPY.world.errors.schemaPendingUpdates}:
                </span>{" "}
                {schemaReadiness.pendingMigrations.join(", ")}
              </p>
            ) : null}
            {schemaReadiness.failedMigrations.length > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {UI_COPY.world.errors.schemaFailedUpdates}:
                </span>{" "}
                {schemaReadiness.failedMigrations.join(", ")}
              </p>
            ) : null}
            {schemaReadiness.extraDatabaseMigrations.length > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {UI_COPY.world.errors.schemaUnexpectedUpdates}:
                </span>{" "}
                {schemaReadiness.extraDatabaseMigrations.join(", ")}
              </p>
            ) : null}
          </section>
        </main>
      </div>
    );
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

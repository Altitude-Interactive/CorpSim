"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  DatabaseSchemaReadiness,
  HEALTH_POLL_INTERVAL_MS,
  WorldHealth,
  getDatabaseSchemaReadiness,
  getWorldHealth
} from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { isAuthPage, isOnboardingPage, isProfilePage, isTutorialPage } from "@/lib/auth-routes";

export type ApiStatusLevel = "green" | "yellow" | "red";

interface WorldHealthContextValue {
  health: WorldHealth | null;
  schemaReadiness: DatabaseSchemaReadiness | null;
  schemaReadinessError: string | null;
  isSchemaReady: boolean;
  error: string | null;
  apiStatus: ApiStatusLevel;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

const WorldHealthContext = createContext<WorldHealthContextValue | null>(null);

function resolveApiStatus(
  schemaReadiness: DatabaseSchemaReadiness | null,
  schemaReadinessError: string | null,
  health: WorldHealth | null,
  error: string | null,
  lastSuccessAt: number | null
): ApiStatusLevel {
  if (schemaReadiness && !schemaReadiness.ready) {
    return "red";
  }

  if (!health && (error || schemaReadinessError)) {
    return "red";
  }

  if (!health) {
    return "yellow";
  }

  const now = Date.now();
  const stale = !lastSuccessAt || now - lastSuccessAt > HEALTH_POLL_INTERVAL_MS * 2;

  if ((error || schemaReadinessError) && stale) {
    return "red";
  }

  if (error || schemaReadinessError || stale) {
    return "yellow";
  }

  return "green";
}

export function WorldHealthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const [health, setHealth] = useState<WorldHealth | null>(null);
  const [schemaReadiness, setSchemaReadiness] = useState<DatabaseSchemaReadiness | null>(null);
  const [schemaReadinessError, setSchemaReadinessError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const mounted = useRef(true);
  const skipPolling =
    isSessionPending ||
    !session?.user?.id ||
    isAuthPage(pathname) ||
    isOnboardingPage(pathname) ||
    isTutorialPage(pathname) ||
    isProfilePage(pathname);

  const refresh = useCallback(async () => {
    if (skipPolling) {
      setIsRefreshing(false);
      setHealth(null);
      setSchemaReadiness(null);
      setSchemaReadinessError(null);
      setError(null);
      setLastSuccessAt(null);
      return;
    }

    setIsRefreshing(true);
    try {
      const readiness = await getDatabaseSchemaReadiness();
      if (!mounted.current) {
        return;
      }
      setSchemaReadiness(readiness);
      setSchemaReadinessError(null);

      if (!readiness.ready) {
        setHealth(null);
        setError(null);
        setLastSuccessAt(null);
        return;
      }
    } catch (caught) {
      if (!mounted.current) {
        return;
      }
      setSchemaReadiness(null);
      setSchemaReadinessError(
        caught instanceof Error ? caught.message : "Failed to fetch database readiness"
      );
      setError(caught instanceof Error ? caught.message : "Failed to fetch world health");
      return;
    }

    try {
      const next = await getWorldHealth();
      if (!mounted.current) {
        return;
      }
      setHealth(next);
      setLastSuccessAt(Date.now());
      setError(null);
    } catch (caught) {
      if (!mounted.current) {
        return;
      }
      setError(caught instanceof Error ? caught.message : "Failed to fetch world health");
    } finally {
      if (mounted.current) {
        setIsRefreshing(false);
      }
    }
  }, [skipPolling]);

  useEffect(() => {
    mounted.current = true;
    void refresh();

    if (skipPolling) {
      return () => {
        mounted.current = false;
      };
    }

    const id = setInterval(() => {
      void refresh();
    }, HEALTH_POLL_INTERVAL_MS);

    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [refresh, skipPolling]);

  const value = useMemo<WorldHealthContextValue>(
    () => ({
      health,
      schemaReadiness,
      schemaReadinessError,
      isSchemaReady: schemaReadiness?.ready !== false,
      error,
      apiStatus: resolveApiStatus(schemaReadiness, schemaReadinessError, health, error, lastSuccessAt),
      isRefreshing,
      refresh
    }),
    [error, health, isRefreshing, lastSuccessAt, refresh, schemaReadiness, schemaReadinessError]
  );

  return <WorldHealthContext.Provider value={value}>{children}</WorldHealthContext.Provider>;
}

export function useWorldHealth() {
  const context = useContext(WorldHealthContext);
  if (!context) {
    throw new Error("useWorldHealth must be used inside WorldHealthProvider");
  }
  return context;
}

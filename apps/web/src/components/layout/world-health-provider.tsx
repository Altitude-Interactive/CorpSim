"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { HEALTH_POLL_INTERVAL_MS, WorldHealth, getWorldHealth } from "@/lib/api";

export type ApiStatusLevel = "green" | "yellow" | "red";

interface WorldHealthContextValue {
  health: WorldHealth | null;
  error: string | null;
  apiStatus: ApiStatusLevel;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
}

const WorldHealthContext = createContext<WorldHealthContextValue | null>(null);

function resolveApiStatus(
  health: WorldHealth | null,
  error: string | null,
  lastSuccessAt: number | null
): ApiStatusLevel {
  if (!health && error) {
    return "red";
  }

  if (!health) {
    return "yellow";
  }

  const now = Date.now();
  const stale = !lastSuccessAt || now - lastSuccessAt > HEALTH_POLL_INTERVAL_MS * 2;

  if (error && stale) {
    return "red";
  }

  if (error || stale) {
    return "yellow";
  }

  return "green";
}

export function WorldHealthProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<WorldHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
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
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();

    const id = setInterval(() => {
      void refresh();
    }, HEALTH_POLL_INTERVAL_MS);

    return () => {
      mounted.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  const value = useMemo<WorldHealthContextValue>(
    () => ({
      health,
      error,
      apiStatus: resolveApiStatus(health, error, lastSuccessAt),
      isRefreshing,
      refresh
    }),
    [error, health, isRefreshing, lastSuccessAt, refresh]
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

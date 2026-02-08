"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CompanySummary, listCompanies } from "@/lib/api";

const ACTIVE_COMPANY_STORAGE_KEY = "corpsim.activeCompanyId";

interface ActiveCompanyContextValue {
  companies: CompanySummary[];
  activeCompanyId: string | null;
  activeCompany: CompanySummary | null;
  isLoading: boolean;
  error: string | null;
  setActiveCompanyId: (companyId: string) => void;
  refreshCompanies: () => Promise<void>;
}

const ActiveCompanyContext = createContext<ActiveCompanyContextValue | null>(null);

function getStoredCompanyId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACTIVE_COMPANY_STORAGE_KEY);
}

function pickInitialCompany(companies: CompanySummary[], storedId: string | null): string | null {
  if (storedId && companies.some((company) => company.id === storedId)) {
    return storedId;
  }

  const playerCompany = companies.find((company) => !company.isBot);
  if (playerCompany) {
    return playerCompany.id;
  }

  return companies[0]?.id ?? null;
}

export function ActiveCompanyProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [activeCompanyId, setActiveCompanyIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setActiveCompanyId = useCallback((companyId: string) => {
    setActiveCompanyIdState(companyId);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, companyId);
    }
  }, []);

  const refreshCompanies = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await listCompanies();
      setCompanies(rows);
      setError(null);
      setActiveCompanyIdState((current) => {
        const preferred = current ?? getStoredCompanyId();
        const next = pickInitialCompany(rows, preferred);
        if (next && typeof window !== "undefined") {
          window.localStorage.setItem(ACTIVE_COMPANY_STORAGE_KEY, next);
        }
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCompanies();
  }, [refreshCompanies]);

  const activeCompany =
    activeCompanyId ? companies.find((company) => company.id === activeCompanyId) ?? null : null;

  const value = useMemo<ActiveCompanyContextValue>(
    () => ({
      companies,
      activeCompanyId,
      activeCompany,
      isLoading,
      error,
      setActiveCompanyId,
      refreshCompanies
    }),
    [
      companies,
      activeCompanyId,
      activeCompany,
      isLoading,
      error,
      setActiveCompanyId,
      refreshCompanies
    ]
  );

  return <ActiveCompanyContext.Provider value={value}>{children}</ActiveCompanyContext.Provider>;
}

export function useActiveCompany() {
  const context = useContext(ActiveCompanyContext);
  if (!context) {
    throw new Error("useActiveCompany must be used inside ActiveCompanyProvider");
  }
  return context;
}

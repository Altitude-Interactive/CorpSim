"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  MAINTENANCE_POLL_INTERVAL_MS,
  MaintenanceState,
  getMaintenanceState
} from "@/lib/maintenance";
import { MaintenanceOverlay } from "./maintenance-overlay";

const APP_CONTENT_ID = "corpsim-app-content";

interface MaintenanceContextValue {
  state: MaintenanceState | null;
  error: string | null;
}

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null);

function applyInteractionLock(enabled: boolean): (() => void) | undefined {
  if (!enabled || typeof document === "undefined") {
    return undefined;
  }

  const body = document.body;
  const content = document.getElementById(APP_CONTENT_ID);
  const previousBodyOverflow = body.style.overflow;
  const previousBodyTouchAction = body.style.touchAction;

  body.style.overflow = "hidden";
  body.style.touchAction = "none";

  let restoreInert = false;
  let previousInert = false;
  let previousAriaHidden: string | null = null;

  if (content) {
    previousAriaHidden = content.getAttribute("aria-hidden");
    content.setAttribute("aria-hidden", "true");

    const withInert = content as HTMLElement & { inert?: boolean };
    if ("inert" in withInert) {
      previousInert = withInert.inert === true;
      withInert.inert = true;
      restoreInert = true;
    } else {
      previousInert = content.hasAttribute("inert");
      content.setAttribute("inert", "");
      restoreInert = true;
    }
  }

  return () => {
    body.style.overflow = previousBodyOverflow;
    body.style.touchAction = previousBodyTouchAction;

    if (!content || !restoreInert) {
      return;
    }

    if (previousAriaHidden === null) {
      content.removeAttribute("aria-hidden");
    } else {
      content.setAttribute("aria-hidden", previousAriaHidden);
    }

    const withInert = content as HTMLElement & { inert?: boolean };
    if ("inert" in withInert) {
      withInert.inert = previousInert;
    } else if (previousInert) {
      content.setAttribute("inert", "");
    } else {
      content.removeAttribute("inert");
    }
  };
}

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MaintenanceState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const refresh = async () => {
      try {
        const next = await getMaintenanceState();
        if (!mounted.current) {
          return;
        }
        setState(next);
        setError(null);
      } catch (caught) {
        if (!mounted.current) {
          return;
        }
        setError(caught instanceof Error ? caught.message : "Failed to fetch maintenance mode");
      }
    };

    void refresh();
    const timerId = setInterval(() => {
      void refresh();
    }, MAINTENANCE_POLL_INTERVAL_MS);

    return () => {
      mounted.current = false;
      clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    const restore = applyInteractionLock(state?.enabled === true);
    return () => {
      restore?.();
    };
  }, [state?.enabled]);

  const value = useMemo<MaintenanceContextValue>(
    () => ({
      state,
      error
    }),
    [error, state]
  );

  const maintenanceEnabled = state?.enabled === true;

  return (
    <MaintenanceContext.Provider value={value}>
      <div
        id={APP_CONTENT_ID}
        className={cn(
          "min-h-screen transition duration-200",
          maintenanceEnabled && "pointer-events-none select-none blur-[2px] brightness-75"
        )}
      >
        {children}
      </div>
      {maintenanceEnabled && state ? <MaintenanceOverlay state={state} /> : null}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenanceMode() {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error("useMaintenanceMode must be used inside MaintenanceProvider");
  }
  return context;
}

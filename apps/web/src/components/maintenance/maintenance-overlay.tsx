"use client";

import { useEffect, useRef } from "react";
import { DEFAULT_MAINTENANCE_REASON, MaintenanceState } from "@/lib/maintenance";

export function MaintenanceOverlay({ state }: { state: MaintenanceState }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    dialog.focus();

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (!dialog.contains(target)) {
        event.preventDefault();
        dialog.focus();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" || event.key === "Escape") {
        event.preventDefault();
        dialog.focus();
      }
    };

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  const message =
    state.reason.trim().length > 0 ? state.reason : DEFAULT_MAINTENANCE_REASON;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="maintenance-title"
        aria-describedby="maintenance-description"
        tabIndex={0}
        className="w-full max-w-xl rounded-2xl border border-slate-600/80 bg-slate-900/95 p-8 text-slate-100 shadow-2xl shadow-black/60 outline-none"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Operations notice</p>
        <h1 id="maintenance-title" className="mt-3 text-2xl font-semibold">
          CorpSim is under maintenance
        </h1>
        <p className="mt-3 text-sm text-slate-200">No ETA</p>
        <p id="maintenance-description" className="mt-4 text-sm leading-6 text-slate-300">
          {message}
        </p>
      </div>
    </div>
  );
}

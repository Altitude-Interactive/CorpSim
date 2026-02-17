"use client";

import { useEffect, useRef, useState } from "react";
import { useUiSfx } from "@/components/layout/ui-sfx-provider";
import { ToastOverlay } from "@/components/ui/toast-manager";
import {
  calculateEtaCountdown,
  DEFAULT_MAINTENANCE_REASON,
  MaintenanceState
} from "@/lib/maintenance";

export function MaintenanceOverlay({ state }: { state: MaintenanceState }) {
  const { play } = useUiSfx();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState(() => calculateEtaCountdown(state.eta));

  useEffect(() => {
    if (!state.eta) {
      setCountdown(null);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextUpdate = () => {
      const nextCountdown = calculateEtaCountdown(state.eta);
      setCountdown(nextCountdown);

      if (!nextCountdown) {
        return;
      }

      const delay = nextCountdown.unit === "minutes" ? 1000 : 60000;
      timeoutId = setTimeout(scheduleNextUpdate, delay);
    };

    scheduleNextUpdate();

    return () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [state.eta]);

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

  useEffect(() => {
    play("feedback_warning", { volumeMultiplier: 0.85, throttleMs: 900 });
    return () => {
      play("ui_close", { volumeMultiplier: 0.6, throttleMs: 180 });
    };
  }, [play]);

  const message =
    state.reason.trim().length > 0 ? state.reason : DEFAULT_MAINTENANCE_REASON;

  return (
    <ToastOverlay
      backdrop="blur"
      variant="default"
      layerClassName="z-[9999]"
      panelClassName="p-8 text-slate-100 outline-none"
      labelledBy="maintenance-title"
      describedBy="maintenance-description"
    >
      <div ref={dialogRef} tabIndex={0}>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Operations notice</p>
        <h1 id="maintenance-title" className="mt-3 text-2xl font-semibold">
          CorpSim is under maintenance
        </h1>
        <p className="mt-3 text-sm text-slate-200">
          {countdown ? `ETA: ${countdown.text}` : "No ETA"}
        </p>
        <p id="maintenance-description" className="mt-4 text-sm leading-6 text-slate-300">
          {message}
        </p>
      </div>
    </ToastOverlay>
  );
}

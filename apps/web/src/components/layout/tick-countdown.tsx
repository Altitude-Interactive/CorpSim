"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { InlineHelp } from "@/components/ui/inline-help";
import { useWorldHealth } from "./world-health-provider";

// Default tick interval (60 seconds) - matches worker default configuration
// TODO: Get this from API configuration endpoint
const DEFAULT_TICK_INTERVAL_MS = 60_000;

export function TickCountdown() {
  const { health } = useWorldHealth();
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!health?.lastAdvancedAt) {
      setSecondsRemaining(null);
      return;
    }

    const updateCountdown = () => {
      const lastAdvancedTime = new Date(health.lastAdvancedAt!).getTime();
      const now = Date.now();
      const elapsed = now - lastAdvancedTime;
      const remaining = DEFAULT_TICK_INTERVAL_MS - (elapsed % DEFAULT_TICK_INTERVAL_MS);
      setSecondsRemaining(Math.ceil(remaining / 1000));
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [health?.lastAdvancedAt, health?.currentTick]);

  if (secondsRemaining === null) {
    return null;
  }

  const helpText = `Time progression: The simulation advances in discrete weeks (ticks). Each week represents ${DEFAULT_TICK_INTERVAL_MS / 1000} seconds of real time. Production jobs, research, and shipments complete when the required number of weeks pass.`;

  return (
    <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      <span title={helpText}>
        Next week in {secondsRemaining}s
      </span>
      <InlineHelp label={helpText} />
    </div>
  );
}

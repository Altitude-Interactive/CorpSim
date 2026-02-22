"use client";

import { useEffect, useState } from "react";
import { getDisplayVersion } from "@/lib/version";
import { cn } from "@/lib/utils";

export function AppVersionBadge({ className }: { className?: string }) {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadVersion = async () => {
      try {
        const nextVersion = await getDisplayVersion();
        if (!active) {
          return;
        }
        setVersion(nextVersion);
      } catch {
        if (!active) {
          return;
        }
        setVersion(null);
      }
    };

    void loadVersion();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={cn("text-muted-foreground", className)}>
      <span className="group relative inline-flex cursor-default items-center gap-1 text-xs">
        <span>{version ? `CorpSim ERP v${version}` : "CorpSim ERP"} - ALPHA</span>
        <span className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 hidden w-64 rounded-md border border-border bg-popover p-2 text-[10px] leading-tight text-popover-foreground shadow-md group-hover:block">
          Preview build provided as-is with no player support. Data may be reset or wiped at any
          time until beta.
        </span>
      </span>
    </div>
  );
}

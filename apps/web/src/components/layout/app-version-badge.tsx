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
    <div className={cn("max-w-[22rem] space-y-1 text-muted-foreground", className)}>
      <p className="text-xs">{version ? `CorpSim ERP v${version}` : "CorpSim ERP"} · ALPHA</p>
      <p className="text-[10px] leading-tight">
        Preview build provided as-is with no player support. Data may be reset or wiped at any time
        until beta.
      </p>
    </div>
  );
}

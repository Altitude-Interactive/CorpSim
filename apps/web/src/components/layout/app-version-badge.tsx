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

  if (!version) {
    return null;
  }

  return <p className={cn("text-xs text-muted-foreground", className)}>CorpSim ERP v{version}</p>;
}

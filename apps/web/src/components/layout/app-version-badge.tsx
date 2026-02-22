"use client";

import { useEffect, useState } from "react";
import { getDiscordServerUrl } from "@/lib/public-links";
import { getDisplayVersion } from "@/lib/version";
import { cn } from "@/lib/utils";

export function AppVersionBadge({ className }: { className?: string }) {
  const [version, setVersion] = useState<string | null>(null);
  const discordServerUrl = getDiscordServerUrl();

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
      <span className="group relative inline-flex items-center gap-1 text-xs">
        {discordServerUrl ? (
          <a
            href={discordServerUrl}
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:text-foreground hover:underline"
            title="Join Discord updates"
          >
            {version ? `CorpSim ERP v${version}` : "CorpSim ERP"} - ALPHA
          </a>
        ) : (
          <span>{version ? `CorpSim ERP v${version}` : "CorpSim ERP"} - ALPHA</span>
        )}
        <span className="pointer-events-none absolute bottom-full left-0 z-40 mb-2 hidden w-64 rounded-md border border-border bg-popover p-2 text-[10px] leading-tight text-popover-foreground shadow-md group-hover:block">
          Preview build provided as-is with no player support. Data may be reset or wiped at any time until beta.
          {discordServerUrl ? " Click the version tag to join Discord updates." : ""}
        </span>
      </span>
    </div>
  );
}

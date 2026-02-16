"use client";
/* eslint-disable @next/next/no-img-element */

import { memo, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { resolveItemIcon } from "@/lib/item-icons";
import { cn } from "@/lib/utils";

interface ItemIconProps {
  itemCode?: string | null;
  itemName: string;
  size?: number;
  className?: string;
}

const loggedMissingMappingKeys = new Set<string>();
const loggedMissingAssetKeys = new Set<string>();

async function logMissingItemToApi(itemCode: string | null, itemName: string, context: string, metadata?: string) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4310";
    await fetch(`${apiUrl}/diagnostics/missing-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        itemCode: itemCode || undefined,
        itemName,
        context,
        source: "web-ui",
        metadata
      })
    });
  } catch (error) {
    console.error("Failed to log missing item to API:", error);
  }
}

function warnMissingIconOnce(key: string, message: string, details: Record<string, string>) {
  const bucket = key.startsWith("asset:") ? loggedMissingAssetKeys : loggedMissingMappingKeys;
  if (bucket.has(key)) {
    return;
  }

  bucket.add(key);
  
  if (process.env.NODE_ENV !== "production") {
    console.warn(message, details);
  }

  const context = key.startsWith("asset:") ? "icon-asset-load-failure" : "icon-mapping-missing";
  const metadata = JSON.stringify(details);
  logMissingItemToApi(details.itemCode === "(null)" ? null : details.itemCode, details.itemName, context, metadata);
}

export const ItemIcon = memo(function ItemIcon({ itemCode, itemName, size = 16, className }: ItemIconProps) {
  const resolution = useMemo(() => resolveItemIcon(itemCode), [itemCode]);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    setHasLoadError(false);
  }, [resolution.src]);

  useEffect(() => {
    if (resolution.status !== "unknown") {
      return;
    }

    warnMissingIconOnce(`mapping:${itemCode ?? "null"}`, "[icons] Missing item icon mapping", {
      itemCode: itemCode ?? "(null)",
      itemName
    });
  }, [itemCode, itemName, resolution.status]);

  useEffect(() => {
    if (!hasLoadError) {
      return;
    }

    warnMissingIconOnce(`asset:${itemCode ?? "null"}:${resolution.src}`, "[icons] Item icon asset failed to load", {
      itemCode: itemCode ?? "(null)",
      itemName,
      iconSrc: resolution.src
    });
  }, [hasLoadError, itemCode, itemName, resolution.src]);

  if (resolution.status === "unknown" || hasLoadError) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-sm border border-amber-500/70 bg-amber-500/15 text-amber-400",
          className
        )}
        style={{ width: size, height: size }}
        title={`Missing icon for ${itemName}`}
        aria-label={`Missing icon for ${itemName}`}
      >
        <AlertTriangle style={{ width: Math.max(10, size - 4), height: Math.max(10, size - 4) }} />
      </span>
    );
  }

  return (
    <img
      src={resolution.src}
      alt={itemName}
      width={size}
      height={size}
      className={cn("rounded-sm", className)}
      style={{ imageRendering: "pixelated" }}
      loading="lazy"
      decoding="async"
      onError={() => {
        setHasLoadError(true);
      }}
    />
  );
});

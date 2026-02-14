"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import Image from "next/image";
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

function warnMissingIconOnce(key: string, message: string, details: Record<string, string>) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const bucket = key.startsWith("asset:") ? loggedMissingAssetKeys : loggedMissingMappingKeys;
  if (bucket.has(key)) {
    return;
  }

  bucket.add(key);
  console.warn(message, details);
}

export function ItemIcon({ itemCode, itemName, size = 16, className }: ItemIconProps) {
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
    <Image
      src={resolution.src}
      alt={itemName}
      width={size}
      height={size}
      className={cn("rounded-sm", className)}
      style={{ imageRendering: "pixelated" }}
      onError={() => {
        setHasLoadError(true);
      }}
    />
  );
}

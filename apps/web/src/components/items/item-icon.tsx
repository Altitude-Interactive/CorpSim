import Image from "next/image";
import { getItemIconSrc } from "@/lib/item-icons";
import { cn } from "@/lib/utils";

interface ItemIconProps {
  itemCode?: string | null;
  itemName: string;
  size?: number;
  className?: string;
}

export function ItemIcon({ itemCode, itemName, size = 16, className }: ItemIconProps) {
  return (
    <Image
      src={getItemIconSrc(itemCode)}
      alt={itemName}
      width={size}
      height={size}
      className={cn("h-4 w-4 rounded-sm", className)}
      style={{ imageRendering: "pixelated" }}
    />
  );
}

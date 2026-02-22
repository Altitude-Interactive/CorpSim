import { ItemLabel } from "@/components/items/item-label";
import { formatQuantityToken } from "@/lib/quantity-controller";
import { cn } from "@/lib/utils";

interface ItemQuantityLabelProps {
  quantity: number;
  itemCode?: string | null;
  itemName: string;
  className?: string;
  quantityClassName?: string;
  itemClassName?: string;
}

export function ItemQuantityLabel({
  quantity,
  itemCode,
  itemName,
  className,
  quantityClassName,
  itemClassName
}: ItemQuantityLabelProps) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}>
      <span className={cn("font-mono text-xs tabular-nums text-muted-foreground", quantityClassName)}>
        {formatQuantityToken(quantity)}
      </span>
      <ItemLabel itemCode={itemCode} itemName={itemName} className={itemClassName} />
    </span>
  );
}

import { ItemIcon } from "@/components/items/item-icon";
import { cn } from "@/lib/utils";

interface ItemLabelProps {
  itemCode?: string | null;
  itemName: string;
  className?: string;
  textClassName?: string;
}

export function ItemLabel({ itemCode, itemName, className, textClassName }: ItemLabelProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <ItemIcon itemCode={itemCode} itemName={itemName} />
      <span className={cn("truncate", textClassName)}>{itemName}</span>
    </span>
  );
}

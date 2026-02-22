import { Fragment } from "react";
import { ItemQuantityLabel } from "@/components/items/item-quantity-label";
import { cn } from "@/lib/utils";

export interface ItemQuantityListEntry {
  key: string;
  quantity: number;
  itemCode?: string | null;
  itemName: string;
}

interface ItemQuantityListProps {
  items: ItemQuantityListEntry[];
  className?: string;
  itemClassName?: string;
  separator?: string;
}

export function ItemQuantityList({
  items,
  className,
  itemClassName,
  separator = ","
}: ItemQuantityListProps) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">--</span>;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {items.map((entry, index) => (
        <Fragment key={entry.key}>
          {index > 0 ? (
            <span aria-hidden="true" className="text-muted-foreground">
              {separator}
            </span>
          ) : null}
          <ItemQuantityLabel
            quantity={entry.quantity}
            itemCode={entry.itemCode}
            itemName={entry.itemName}
            className={itemClassName}
          />
        </Fragment>
      ))}
    </div>
  );
}

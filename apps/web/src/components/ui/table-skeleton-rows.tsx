import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface TableSkeletonRowsProps {
  columns: number;
  rows?: number;
  className?: string;
}

const WIDTH_CLASSES = ["w-12", "w-16", "w-20", "w-24", "w-28", "w-32"] as const;

export function TableSkeletonRows({ columns, rows = 8, className }: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={`table-skeleton-row-${rowIndex}`} aria-hidden>
          {Array.from({ length: columns }, (_, columnIndex) => (
            <TableCell key={`table-skeleton-cell-${rowIndex}-${columnIndex}`}>
              <div
                className={cn(
                  "h-3 animate-pulse rounded bg-muted",
                  WIDTH_CLASSES[(rowIndex + columnIndex) % WIDTH_CLASSES.length],
                  className
                )}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

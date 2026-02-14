import { TableCell, TableRow } from "@/components/ui/table";

interface TableFillerRowsProps {
  columns: number;
  currentRows: number;
  targetRows: number;
}

export function TableFillerRows({ columns, currentRows, targetRows }: TableFillerRowsProps) {
  const fillerRows = Math.max(0, targetRows - currentRows);
  if (fillerRows === 0) {
    return null;
  }

  return (
    <>
      {Array.from({ length: fillerRows }, (_, index) => (
        <TableRow key={`table-filler-${index}`} aria-hidden className="pointer-events-none">
          <TableCell colSpan={columns} className="h-11" />
        </TableRow>
      ))}
    </>
  );
}


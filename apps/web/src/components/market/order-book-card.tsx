import { MarketOrder } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SideBadge, StatusBadge } from "./market-badges";

interface OrderBookCardProps {
  orders: MarketOrder[];
  isLoading: boolean;
  regionNameById: Record<string, string>;
}

export function OrderBookCard({ orders, isLoading, regionNameById }: OrderBookCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Book</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Remaining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">{order.id}</TableCell>
                <TableCell className="font-mono text-xs">{order.itemId}</TableCell>
                <TableCell className="text-xs">{regionNameById[order.regionId] ?? order.regionId}</TableCell>
                <TableCell className="font-mono text-xs">{order.companyId}</TableCell>
                <TableCell>
                  <SideBadge side={order.side} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="tabular-nums">{formatCents(order.priceCents)}</TableCell>
                <TableCell className="tabular-nums">{order.quantity}</TableCell>
                <TableCell className="tabular-nums">{order.remainingQuantity}</TableCell>
              </TableRow>
            ))}
            {!isLoading && orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No orders found for selected filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

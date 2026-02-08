import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarketOrder } from "@/lib/api";
import { SideBadge, StatusBadge } from "./market-badges";

interface MyOrdersCardProps {
  orders: MarketOrder[];
  isLoading: boolean;
  onCancel: (order: MarketOrder) => Promise<void>;
}

export function MyOrdersCard({ orders, isLoading, onCancel }: MyOrdersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Orders</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">{order.id}</TableCell>
                <TableCell className="font-mono text-xs">{order.itemId}</TableCell>
                <TableCell>
                  <SideBadge side={order.side} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="tabular-nums">{order.priceCents}</TableCell>
                <TableCell className="tabular-nums">{order.remainingQuantity}</TableCell>
                <TableCell className="text-right">
                  {order.status === "OPEN" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        void onCancel(order);
                      }}
                    >
                      Cancel
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Closed</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No orders for the active company.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

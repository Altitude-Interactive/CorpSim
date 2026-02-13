import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ItemLabel } from "@/components/items/item-label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarketOrder } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_COPY } from "@/lib/ui-copy";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";
import { SideBadge, StatusBadge } from "./market-badges";

interface MyOrdersCardProps {
  orders: MarketOrder[];
  isLoading: boolean;
  onCancel: (order: MarketOrder) => Promise<void>;
  regionNameById: Record<string, string>;
  itemMetaById: Record<string, { code: string; name: string }>;
}

export function MyOrdersCard({
  orders,
  isLoading,
  onCancel,
  regionNameById,
  itemMetaById
}: MyOrdersCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Orders</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{`Placed ${UI_CADENCE_TERMS.singularTitle}`}</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Region</TableHead>
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
                <TableCell className="tabular-nums">{order.tickPlaced.toLocaleString()}</TableCell>
                <TableCell className="text-xs">
                  <ItemLabel
                    itemCode={itemMetaById[order.itemId]?.code}
                    itemName={itemMetaById[order.itemId]?.name ?? UI_COPY.common.unknownItem}
                  />
                </TableCell>
                <TableCell className="text-xs">
                  {regionNameById[order.regionId] ?? UI_COPY.common.unknownRegion}
                </TableCell>
                <TableCell>
                  <SideBadge side={order.side} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell className="tabular-nums">{formatCents(order.priceCents)}</TableCell>
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
                <TableCell colSpan={8} className="text-center text-muted-foreground">
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

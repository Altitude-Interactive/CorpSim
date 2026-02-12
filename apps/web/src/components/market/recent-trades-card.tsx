import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarketTrade } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_CADENCE_TERMS } from "@/lib/ui-terms";

interface RecentTradesCardProps {
  trades: MarketTrade[];
  isLoading: boolean;
  regionNameById: Record<string, string>;
}

export function RecentTradesCard({ trades, isLoading, regionNameById }: RecentTradesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Trades</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{UI_CADENCE_TERMS.singularTitle}</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Buyer</TableHead>
              <TableHead>Seller</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Qty</TableHead>
              <TableHead>Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade.id}>
                <TableCell className="tabular-nums">{trade.tick}</TableCell>
                <TableCell className="font-mono text-xs">{trade.itemId}</TableCell>
                <TableCell className="text-xs">{regionNameById[trade.regionId] ?? trade.regionId}</TableCell>
                <TableCell className="font-mono text-xs">{trade.buyerId}</TableCell>
                <TableCell className="font-mono text-xs">{trade.sellerId}</TableCell>
                <TableCell className="tabular-nums">{formatCents(trade.priceCents)}</TableCell>
                <TableCell className="tabular-nums">{trade.quantity}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(trade.createdAt).toLocaleTimeString()}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && trades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No recent trades found.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

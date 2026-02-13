"use client";

import { useCallback, useEffect, useState } from "react";
import { ItemLabel } from "@/components/items/item-label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompanySummary, InventoryRow, listCompanies, listCompanyInventory } from "@/lib/api";

export function InventoryView() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async (companyId: string) => {
    if (!companyId) {
      return;
    }

    setIsLoading(true);
    try {
      const inventoryRows = await listCompanyInventory(companyId);
      setRows(inventoryRows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load inventory");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      try {
        const companyList = await listCompanies();
        if (!active) {
          return;
        }

        setCompanies(companyList);
        const firstCompanyId = companyList[0]?.id ?? "";
        setSelectedCompanyId(firstCompanyId);
        await loadInventory(firstCompanyId);
      } catch (caught) {
        if (!active) {
          return;
        }
        setError(caught instanceof Error ? caught.message : "Failed to load companies");
        setIsLoading(false);
      }
    };

    void bootstrap();
    return () => {
      active = false;
    };
  }, [loadInventory]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Company Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Select
              value={selectedCompanyId}
              onValueChange={(value) => {
                setSelectedCompanyId(value);
                void loadInventory(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((company) => (
                  <SelectItem value={company.id} key={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Reserved</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.itemId}>
                  <TableCell>
                    <ItemLabel itemCode={row.itemCode} itemName={row.itemName} />
                  </TableCell>
                  <TableCell className="tabular-nums">{row.quantity}</TableCell>
                  <TableCell className="tabular-nums">{row.reservedQuantity}</TableCell>
                </TableRow>
              ))}
              {!isLoading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No inventory rows for this company.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          {isLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading inventory...</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

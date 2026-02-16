"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { ItemLabel } from "@/components/items/item-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeferredSearchStatus } from "@/components/ui/deferred-search-status";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlayerRegistryEntry, listPlayerRegistry } from "@/lib/api";
import { formatCents } from "@/lib/format";

interface SearchablePlayer {
  player: PlayerRegistryEntry;
  searchText: string;
}

function formatJoinedDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString();
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

export function PlayerRegistryCatalogPage() {
  const [players, setPlayers] = useState<PlayerRegistryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const loadPlayers = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await listPlayerRegistry();
      setPlayers(rows);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load player registry");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlayers();
  }, [loadPlayers]);

  const searchablePlayers = useMemo(() => {
    return players.map((player) => {
      const companyText = player.companies
        .map((company) => {
          const itemsText = company.itemHoldings
            .map((item) => `${item.itemCode} ${item.itemName}`)
            .join(" ");
          return `${company.code} ${company.name} ${company.regionCode} ${company.regionName} ${itemsText}`;
        })
        .join(" ");

      return {
        player,
        searchText: `${player.handle} ${companyText}`.toLowerCase()
      };
    });
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    if (!needle) {
      return searchablePlayers;
    }

    return searchablePlayers.filter((row) => row.searchText.includes(needle));
  }, [deferredSearch, searchablePlayers]);

  const totalCompanies = useMemo(() => {
    return players.reduce((sum, player) => sum + player.companies.length, 0);
  }, [players]);

  const totalItemRows = useMemo(() => {
    return players.reduce(
      (sum, player) =>
        sum + player.companies.reduce((companySum, company) => companySum + company.itemHoldings.length, 0),
      0
    );
  }, [players]);

  if (players.length === 0 && isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Player Registry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Loading players and company holdings...</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadPlayers()} disabled>
            Reload
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Player Registry</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Browse players, their companies, and the goods each company currently holds.
          </p>
          <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
            <p>
              Players: <span className="tabular-nums text-foreground">{players.length.toLocaleString()}</span>
            </p>
            <p>
              Companies:{" "}
              <span className="tabular-nums text-foreground">{totalCompanies.toLocaleString()}</span>
            </p>
            <p>
              Stocked Item Types:{" "}
              <span className="tabular-nums text-foreground">{totalItemRows.toLocaleString()}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by player, company, item code, or item name"
              className="w-full md:w-[32rem]"
            />
            <DeferredSearchStatus isUpdating={deferredSearch !== search} />
            <Button type="button" variant="outline" size="sm" onClick={() => void loadPlayers()} disabled={isLoading}>
              Reload
            </Button>
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <p className="text-xs text-muted-foreground">
            Showing {pluralize(filteredPlayers.length, "player", "players")}
          </p>
        </CardContent>
      </Card>

      {filteredPlayers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">No players matched that search.</p>
          </CardContent>
        </Card>
      ) : null}

      {filteredPlayers.map((row: SearchablePlayer) => {
        const player = row.player;
        return (
          <Card key={player.id}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                <span>@{player.handle}</span>
                <Badge variant="info">{pluralize(player.companies.length, "company", "companies")}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Joined on <span className="text-foreground">{formatJoinedDate(player.createdAt)}</span>
              </p>
              {player.companies.length === 0 ? (
                <p className="text-sm text-muted-foreground">No companies yet.</p>
              ) : (
                <div className="space-y-3">
                  {player.companies.map((company) => (
                    <div key={company.id} className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{company.name}</p>
                        <Badge variant="muted" className="font-mono text-[10px]">
                          {company.code}
                        </Badge>
                        <Badge variant={company.isBot ? "warning" : "success"}>
                          {company.isBot ? "Automated" : "Player-run"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Location: {company.regionName} ({company.regionCode}) | Cash on hand:{" "}
                        <span className="text-foreground">
                          {company.cashCents !== undefined ? formatCents(company.cashCents) : "Hidden"}
                        </span>
                      </p>
                      {company.itemHoldings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No stock right now.</p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            {pluralize(company.itemHoldings.length, "item type", "item types")} in stock
                          </p>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead>Item Code</TableHead>
                                <TableHead className="text-right">Available</TableHead>
                                <TableHead className="text-right">Reserved</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {company.itemHoldings.map((item) => (
                                <TableRow key={`${company.id}-${item.itemId}`}>
                                  <TableCell>
                                    <ItemLabel itemCode={item.itemCode} itemName={item.itemName} />
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{item.itemCode}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {item.quantity.toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {item.reservedQuantity.toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

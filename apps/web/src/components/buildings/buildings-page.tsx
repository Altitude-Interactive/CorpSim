"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { useWorldHealth } from "@/components/layout/world-health-provider";
import { useToastManager } from "@/components/ui/toast-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  BuildingRecord,
  BuildingStatus,
  BuildingTypeDefinition,
  listBuildings,
  getBuildingTypeDefinitions,
  reactivateBuilding
} from "@/lib/api";
import { formatCents } from "@/lib/format";
import { UI_COPY } from "@/lib/ui-copy";
import { AcquireBuildingDialog } from "./acquire-building-dialog";

const STATUS_BADGE_VARIANTS: Record<BuildingStatus, "default" | "muted" | "danger"> = {
  ACTIVE: "default",
  INACTIVE: "danger",
  CONSTRUCTION: "muted"
};

export function BuildingsPage() {
  const { activeCompany, activeCompanyId } = useActiveCompany();
  const { health } = useWorldHealth();
  const { showToast } = useToastManager();
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [definitions, setDefinitions] = useState<BuildingTypeDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acquireDialogOpen, setAcquireDialogOpen] = useState(false);

  const loadBuildings = useCallback(async () => {
    if (!activeCompanyId) {
      setBuildings([]);
      return;
    }

    setIsLoading(true);
    try {
      const buildingRecords = await listBuildings({ companyId: activeCompanyId });
      setBuildings(buildingRecords);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load buildings");
    } finally {
      setIsLoading(false);
    }
  }, [activeCompanyId]);

  const loadDefinitions = useCallback(async () => {
    try {
      const defs = await getBuildingTypeDefinitions();
      setDefinitions(defs);
    } catch (caught) {
      console.error("Failed to load building definitions:", caught);
    }
  }, []);

  useEffect(() => {
    void loadBuildings();
  }, [loadBuildings]);

  useEffect(() => {
    void loadDefinitions();
  }, [loadDefinitions]);

  useEffect(() => {
    const tick = health?.currentTick;
    if (tick === undefined || !activeCompanyId) {
      return;
    }

    const timeout = setTimeout(() => {
      void loadBuildings();
    }, 500);

    return () => clearTimeout(timeout);
  }, [health?.currentTick, loadBuildings, activeCompanyId]);

  const groupedBuildings = useMemo(() => {
    const byRegion: Record<string, BuildingRecord[]> = {};
    
    for (const building of buildings) {
      const key = building.region.name;
      if (!byRegion[key]) {
        byRegion[key] = [];
      }
      byRegion[key].push(building);
    }

    return byRegion;
  }, [buildings]);

  const handleReactivate = useCallback(
    async (buildingId: string) => {
      try {
        await reactivateBuilding(buildingId);
        showToast({
          title: "Building Reactivated",
          variant: "success"
        });
        void loadBuildings();
      } catch (caught) {
        showToast({
          title: "Reactivation Failed",
          description: caught instanceof Error ? caught.message : "Failed to reactivate building",
          variant: "error"
        });
      }
    },
    [loadBuildings, showToast]
  );

  const handleAcquireSuccess = useCallback(() => {
    setAcquireDialogOpen(false);
    void loadBuildings();
  }, [loadBuildings]);

  if (!activeCompanyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Buildings</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{UI_COPY.common.noCompanySelected}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Buildings</CardTitle>
          <Button onClick={() => setAcquireDialogOpen(true)}>Acquire Building</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Active company: {activeCompany?.name ?? UI_COPY.common.noCompanySelected}
          </p>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {isLoading && buildings.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading buildings...</p>
          ) : buildings.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No buildings owned. Click &quot;Acquire Building&quot; to purchase your first facility.
            </p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedBuildings).map(([regionName, regionBuildings]) => (
                <div key={regionName}>
                  <h3 className="mb-2 text-sm font-semibold">{regionName}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Weekly Cost</TableHead>
                        <TableHead className="text-right">Capacity</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {regionBuildings.map((building) => {
                        const definition = definitions.find(
                          (d) => d.buildingType === building.buildingType
                        );
                        return (
                          <TableRow key={building.id}>
                            <TableCell>
                              {definition?.name ?? building.buildingType}
                              {definition?.category && (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  ({definition.category})
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {building.name || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={STATUS_BADGE_VARIANTS[building.status]}>
                                {building.status}
                              </Badge>
                              {building.status === "INACTIVE" && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Cannot afford operating costs
                                </p>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCents(building.weeklyOperatingCostCents)}
                            </TableCell>
                            <TableCell className="text-right">
                              {building.capacitySlots}
                              {definition?.category === "STORAGE" && (
                                <span className="text-xs text-muted-foreground">
                                  {" "}
                                  (+{definition.storageCapacity} storage)
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {building.status === "INACTIVE" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReactivate(building.id)}
                                >
                                  Reactivate
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AcquireBuildingDialog
        open={acquireDialogOpen}
        onOpenChange={setAcquireDialogOpen}
        onSuccess={handleAcquireSuccess}
      />
    </div>
  );
}

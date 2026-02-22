"use client";

import { useCallback, useEffect, useState } from "react";
import { useActiveCompany } from "@/components/company/active-company-provider";
import { useToastManager } from "@/components/ui/toast-manager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BuildingType,
  BuildingTypeDefinition,
  RegionSummary,
  acquireBuilding,
  getBuildingTypeDefinitions,
  listRegions
} from "@/lib/api";
import { formatCents } from "@/lib/format";

interface AcquireBuildingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AcquireBuildingDialog({
  open,
  onOpenChange,
  onSuccess
}: AcquireBuildingDialogProps) {
  const { activeCompany, activeCompanyId } = useActiveCompany();
  const { showToast } = useToastManager();
  const [definitions, setDefinitions] = useState<BuildingTypeDefinition[]>([]);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [selectedBuildingType, setSelectedBuildingType] = useState<string>("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [buildingName, setBuildingName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [defs, regs] = await Promise.all([
        getBuildingTypeDefinitions(),
        listRegions()
      ]);
      setDefinitions(defs);
      setRegions(regs);
    } catch (caught) {
      console.error("Failed to load building data:", caught);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadData();
      setSelectedRegionId(activeCompany?.regionId ?? "");
      setSelectedBuildingType("");
      setBuildingName("");
    }
  }, [open, loadData, activeCompany?.regionId]);

  const selectedDefinition = definitions.find((d) => d.buildingType === selectedBuildingType);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      if (!activeCompanyId || !selectedBuildingType || !selectedRegionId) {
        return;
      }

      setIsSubmitting(true);
      try {
        await acquireBuilding({
          companyId: activeCompanyId,
          regionId: selectedRegionId,
          buildingType: selectedBuildingType as BuildingType,
          name: buildingName || undefined
        });

        showToast({
          title: "Building Acquired",
          description: `Successfully acquired ${selectedDefinition?.name ?? selectedBuildingType}`,
          variant: "success"
        });

        onSuccess();
      } catch (caught) {
        showToast({
          title: "Acquisition Failed",
          description: caught instanceof Error ? caught.message : "Failed to acquire building",
          variant: "error"
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      activeCompanyId,
      selectedBuildingType,
      selectedRegionId,
      buildingName,
      selectedDefinition,
      onSuccess,
      showToast
    ]
  );

  const currentCash = activeCompany?.cashCents
    ? BigInt(activeCompany.cashCents)
    : BigInt(0);
  const acquisitionCost = selectedDefinition
    ? BigInt(selectedDefinition.acquisitionCostCents)
    : BigInt(0);
  const canAfford = currentCash >= acquisitionCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Acquire Building</DialogTitle>
            <DialogDescription>
              Purchase a new building to expand your operations
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="building-type">Building Type</Label>
              <Select value={selectedBuildingType} onValueChange={setSelectedBuildingType}>
                <SelectTrigger id="building-type">
                  <SelectValue placeholder="Select building type" />
                </SelectTrigger>
                <SelectContent>
                  {definitions.map((def) => (
                    <SelectItem key={def.buildingType} value={def.buildingType}>
                      {def.name} ({def.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDefinition && (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <p className="font-medium">{selectedDefinition.name}</p>
                <p className="text-muted-foreground">{selectedDefinition.description}</p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Acquisition Cost</p>
                    <p className="font-mono">
                      {formatCents(selectedDefinition.acquisitionCostCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Weekly Operating Cost</p>
                    <p className="font-mono">
                      {formatCents(selectedDefinition.weeklyOperatingCostCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Capacity Slots</p>
                    <p className="font-mono">{selectedDefinition.capacitySlots}</p>
                  </div>
                  {selectedDefinition.storageCapacity !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Storage Capacity</p>
                      <p className="font-mono">+{selectedDefinition.storageCapacity} items</p>
                    </div>
                  )}
                </div>
                <div className="pt-2">
                  <p className="text-xs text-muted-foreground">Your Cash</p>
                  <p className={`font-mono ${!canAfford ? "text-destructive" : ""}`}>
                    {formatCents(currentCash.toString())}
                  </p>
                  {!canAfford && (
                    <p className="mt-1 text-xs text-destructive">Insufficient funds</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
                <SelectTrigger id="region">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regions.map((region) => (
                    <SelectItem key={region.id} value={region.id}>
                      {region.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="building-name">Building Name (Optional)</Label>
              <Input
                id="building-name"
                placeholder="e.g., Main Factory"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedBuildingType || !selectedRegionId || !canAfford || isSubmitting}
            >
              {isSubmitting ? "Acquiring..." : "Acquire Building"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { RegionalStorageInfo, getRegionalStorageInfo } from "@/lib/api";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, AlertCircle } from "lucide-react";

interface StorageMeterProps {
  companyId: string;
  regionId: string;
  className?: string;
  showDetails?: boolean;
}

export function StorageMeter({
  companyId,
  regionId,
  className = "",
  showDetails = true
}: StorageMeterProps) {
  const [info, setInfo] = useState<RegionalStorageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadInfo = async () => {
      setIsLoading(true);
      try {
        const storageInfo = await getRegionalStorageInfo(companyId, regionId);
        if (mounted) {
          setInfo(storageInfo);
          setError(null);
        }
      } catch (caught) {
        if (mounted) {
          setError(caught instanceof Error ? caught.message : "Failed to load storage info");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInfo();

    return () => {
      mounted = false;
    };
  }, [companyId, regionId]);

  if (isLoading) {
    return (
      <div className={className}>
        <div className="text-xs text-muted-foreground">Loading storage info...</div>
      </div>
    );
  }

  if (error || !info) {
    return null;
  }

  const percentage = info.usagePercentage;
  const warningThreshold = 80;
  const criticalThreshold = 95;
  const fullThreshold = 100;

  let progressColor = "bg-primary";
  let showWarning = false;
  let warningMessage = "";
  let warningIcon = <AlertTriangle className="h-4 w-4" />;

  if (percentage >= fullThreshold) {
    progressColor = "bg-destructive";
    showWarning = true;
    warningMessage = "Storage is full! Cannot store more items.";
    warningIcon = <AlertCircle className="h-4 w-4" />;
  } else if (percentage >= criticalThreshold) {
    progressColor = "bg-destructive";
    showWarning = true;
    warningMessage = `Storage is ${percentage.toFixed(0)}% full. Critical capacity!`;
  } else if (percentage >= warningThreshold) {
    progressColor = "bg-yellow-500";
    showWarning = true;
    warningMessage = `Storage is ${percentage.toFixed(0)}% full. Consider expanding.`;
  }

  return (
    <div className={className}>
      {showDetails && (
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Regional Storage</span>
          <span className="font-mono">
            {info.currentUsage.toLocaleString()} / {info.maxCapacity.toLocaleString()}
          </span>
        </div>
      )}

      <Progress value={percentage} className="h-2" indicatorClassName={progressColor} />

      {showDetails && (
        <div className="mt-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{percentage.toFixed(1)}% used</span>
          {info.warehouseCount > 0 && (
            <span className="text-muted-foreground">
              {info.warehouseCount} warehouse{info.warehouseCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {showWarning && showDetails && (
        <Alert variant={percentage >= fullThreshold ? "destructive" : "default"} className="mt-2">
          <div className="flex items-start gap-2">
            {warningIcon}
            <AlertDescription className="text-xs">{warningMessage}</AlertDescription>
          </div>
        </Alert>
      )}
    </div>
  );
}

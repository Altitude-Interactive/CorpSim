export const MAINTENANCE_SCOPES = ["all", "web-only"] as const;

export type MaintenanceScope = (typeof MAINTENANCE_SCOPES)[number];

export interface MaintenanceState {
  enabled: boolean;
  updatedAt: string;
  reason: string;
  enabledBy?: string;
  scope: MaintenanceScope;
  eta?: string;
}

export interface MaintenanceStateUpdate {
  enabled: boolean;
  reason?: string;
  enabledBy?: string;
  scope?: MaintenanceScope;
  eta?: string;
}

export const DEFAULT_MAINTENANCE_REASON = "Systems are currently being updated.";

export const MAINTENANCE_POLL_INTERVAL_MS = 2_000;
export const DEFAULT_MAINTENANCE_REASON = "Systems are currently being updated.";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

type JsonRecord = Record<string, unknown>;

export type MaintenanceScope = "all" | "web-only";

export interface MaintenanceState {
  enabled: boolean;
  updatedAt: string;
  reason: string;
  enabledBy?: string;
  scope: MaintenanceScope;
  eta?: string | null;
}

export interface EtaCountdown {
  text: string;
  unit: "minutes" | "hours" | "days";
  value: number;
}

export function calculateEtaCountdown(
  eta: string | null | undefined
): EtaCountdown | null {
  if (!eta) {
    return null;
  }

  const etaTime = Date.parse(eta);
  if (Number.isNaN(etaTime)) {
    return null;
  }
  const now = Date.now();
  const diffMs = etaTime - now;

  if (diffMs <= 0) {
    return null;
  }

  const minutes = Math.ceil(diffMs / (1000 * 60));
  const hours = Math.ceil(diffMs / (1000 * 60 * 60));
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 60) {
    return {
      text: `${minutes} ${minutes === 1 ? "minute" : "minutes"}`,
      unit: "minutes",
      value: minutes
    };
  }

  if (hours < 24) {
    return {
      text: `${hours} ${hours === 1 ? "hour" : "hours"}`,
      unit: "hours",
      value: hours
    };
  }

  return {
    text: `${days} ${days === 1 ? "day" : "days"}`,
    unit: "days",
    value: days
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function normalizeApiBaseUrl(): string | null {
  if (!API_BASE_URL) {
    return null;
  }

  return API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
}

function sanitizeUpdatedAt(value: unknown): string {
  if (typeof value !== "string") {
    return new Date().toISOString();
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return new Date().toISOString();
  }

  return new Date(parsed).toISOString();
}

function sanitizeReason(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_MAINTENANCE_REASON;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_MAINTENANCE_REASON;
}

function sanitizeEnabledBy(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeScope(value: unknown): MaintenanceScope {
  return value === "web-only" ? "web-only" : "all";
}

function sanitizeEta(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString();
}

function parseMaintenanceState(payload: unknown): MaintenanceState {
  if (!isRecord(payload)) {
    throw new Error("Invalid maintenance payload");
  }

  return {
    enabled: payload.enabled === true,
    updatedAt: sanitizeUpdatedAt(payload.updatedAt),
    reason: sanitizeReason(payload.reason),
    enabledBy: sanitizeEnabledBy(payload.enabledBy),
    scope: sanitizeScope(payload.scope),
    eta: sanitizeEta(payload.eta)
  };
}

async function fetchMaintenanceFromUrl(url: string): Promise<MaintenanceState> {
  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Maintenance endpoint failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return parseMaintenanceState(payload);
}

export async function getMaintenanceState(): Promise<MaintenanceState> {
  const candidates: string[] = [];
  const apiBase = normalizeApiBaseUrl();
  const isProduction = process.env.NODE_ENV === "production";

  if (apiBase) {
    candidates.push(`${apiBase}/health/maintenance`);
  } else {
    candidates.push("/health/maintenance");
  }

  if (!isProduction) {
    candidates.push("/api/dev/maintenance");
  }

  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return await fetchMaintenanceFromUrl(candidate);
    } catch (caught) {
      lastError = caught;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to load maintenance state");
}

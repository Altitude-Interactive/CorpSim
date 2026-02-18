import { isLocalhostHostname, isLocalhostUrl } from "./localhost-utils";

export const HEALTH_POLL_INTERVAL_MS = 15_000;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

// Warn if API URL appears misconfigured (client-side only, production only)
if (typeof window !== "undefined") {
  const currentHost = window.location.hostname;
  const isProduction = !isLocalhostHostname(currentHost);

  if (isProduction && !API_BASE_URL) {
    console.warn(
      "[CorpSim API Client] NEXT_PUBLIC_API_URL is not set. API requests may fail. " +
      "Ensure NEXT_PUBLIC_API_URL is set as a build argument when building the Docker image."
    );
  } else if (isProduction && isLocalhostUrl(API_BASE_URL)) {
    console.warn(
      `[CorpSim API Client] NEXT_PUBLIC_API_URL is set to "${API_BASE_URL}" but you're accessing from "${currentHost}". ` +
      "This likely means the environment variable was not set as a build argument. " +
      "Set NEXT_PUBLIC_API_URL as a build argument in your deployment platform and rebuild."
    );
  }
}

type JsonRecord = Record<string, unknown>;

export class ApiClientError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

export function readString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid response field "${field}" (expected string)`);
  }
  return value;
}

export function readNullableString(value: unknown, field: string): string | null {
  if (value === null) {
    return null;
  }
  return readString(value, field);
}

export function readNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid response field "${field}" (expected number)`);
  }
  return value;
}

export function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid response field "${field}" (expected boolean)`);
  }
  return value;
}

export function readArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid response field "${field}" (expected array)`);
  }
  return value;
}

function sanitizeApiErrorMessage(status: number, rawMessage: string): string {
  const message = rawMessage.trim().replace(/\s+/g, " ");
  const normalized = message.toLowerCase();

  if (status >= 500) {
    return "The server failed to process the request. Please try again.";
  }

  if (normalized.includes("insufficient input inventory for item")) {
    return "Insufficient input inventory for one or more required items.";
  }
  if (normalized.includes("insufficient input inventory")) {
    return "Insufficient input inventory for this operation.";
  }
  if (normalized.includes("is not unlocked for company")) {
    return "This recipe is not unlocked for the active company.";
  }
  if (normalized.includes("not available for company specialization")) {
    return "This item is outside your current company focus.";
  }
  if (normalized.includes("contract item is not available for company specialization")) {
    return "This contract item is outside your current company focus.";
  }
  if (normalized.includes("company focus can be changed every")) {
    const remainingHoursMatch = message.match(/;\s*(\d+)\s+hours?\s+remaining/i);
    if (remainingHoursMatch) {
      const remainingHours = Number.parseInt(remainingHoursMatch[1] ?? "", 10);
      if (Number.isInteger(remainingHours) && remainingHours > 0) {
        return `You recently changed company focus. Try again in about ${remainingHours} hour${remainingHours === 1 ? "" : "s"}.`;
      }
    }
    return "You recently changed company focus. Please wait before changing it again.";
  }
  if (normalized.includes("not found")) {
    if (normalized.includes("company")) {
      return "The selected company was not found. Refresh and try again.";
    }
    if (normalized.includes("item")) {
      return "The selected item was not found. Refresh and try again.";
    }
    if (normalized.includes("region")) {
      return "The selected region was not found. Refresh and try again.";
    }
    return "The requested record was not found.";
  }
  if (normalized.includes("cursor is invalid")) {
    return "The list state is no longer valid. Refresh and try again.";
  }

  // Do not surface internal identifiers in user-facing errors.
  if (/\b[a-z0-9]{20,}\b/i.test(message)) {
    return status >= 400 && status < 500
      ? "The request could not be completed. Please review your input and try again."
      : "Request failed. Please try again.";
  }

  return message;
}

function resolveApiBaseUrl(): string {
  if (!API_BASE_URL) {
    return "";
  }

  return API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
}

export async function fetchJson<T>(
  path: string,
  parser: (value: unknown) => T,
  init?: RequestInit
): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
  const requestInit: RequestInit = {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    credentials: "include",
    cache: "no-store"
  };

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, requestInit);
  } catch (caught) {
    const shouldRetryViaProxy =
      typeof window !== "undefined" && baseUrl.length > 0 && caught instanceof TypeError;
    if (!shouldRetryViaProxy) {
      throw caught;
    }

    response = await fetch(path, requestInit);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch (parseError) {
    // If JSON parsing fails and response is not OK, we'll still throw with status
    // If JSON parsing fails but response is OK, payload remains null
    if (process.env.NODE_ENV === "development") {
      console.warn("Failed to parse API response JSON:", parseError);
    }
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    if (isRecord(payload)) {
      if (typeof payload.message === "string") {
        message = payload.message;
      } else if (Array.isArray(payload.message)) {
        message = payload.message.filter((entry) => typeof entry === "string").join(", ");
      }
    }
    throw new ApiClientError(response.status, sanitizeApiErrorMessage(response.status, message));
  }

  return parser(payload);
}

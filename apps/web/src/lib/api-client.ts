export const HEALTH_POLL_INTERVAL_MS = 3_000;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
const PLAYER_HANDLE_STORAGE_KEY = "corpsim.playerHandle";
const DEFAULT_PLAYER_HANDLE = "PLAYER";

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

function resolvePlayerHandle(): string {
  if (typeof window === "undefined") {
    return DEFAULT_PLAYER_HANDLE;
  }

  const fromStorage = window.localStorage.getItem(PLAYER_HANDLE_STORAGE_KEY)?.trim();
  return fromStorage && fromStorage.length > 0 ? fromStorage : DEFAULT_PLAYER_HANDLE;
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
      "X-Player-Handle": resolvePlayerHandle(),
      ...(init?.headers ?? {})
    },
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

  const payload = (await response.json().catch(() => null)) as unknown;

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

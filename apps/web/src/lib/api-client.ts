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
    throw new ApiClientError(response.status, message);
  }

  return parser(payload);
}

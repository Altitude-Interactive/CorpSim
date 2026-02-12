const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";

interface VersionPayload {
  version?: unknown;
}

function normalizeApiBaseUrl(): string | null {
  if (!API_BASE_URL) {
    return null;
  }

  return API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
}

function parseVersion(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid version payload");
  }

  const row = payload as VersionPayload;
  if (typeof row.version !== "string") {
    throw new Error("Invalid version field");
  }

  const trimmed = row.version.trim();
  if (!trimmed) {
    throw new Error("Version is empty");
  }

  return trimmed;
}

async function fetchVersion(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Version endpoint failed with status ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return parseVersion(payload);
}

export async function getDisplayVersion(): Promise<string> {
  const apiBase = normalizeApiBaseUrl();
  const candidates = apiBase ? [`${apiBase}/meta/version`, "/meta/version"] : ["/meta/version"];
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return await fetchVersion(candidate);
    } catch (caught) {
      lastError = caught;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to load version");
}

export function resolveOptionalPublicUrl(value: string | undefined): string | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getDiscordServerUrl(): string | null {
  return resolveOptionalPublicUrl(process.env.NEXT_PUBLIC_DISCORD_SERVER_URL);
}

interface PublicLinksPayload {
  discordServerUrl?: string | null;
}

export async function fetchDiscordServerUrlFromMeta(signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch("/meta/public-links", {
      cache: "no-store",
      signal
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json().catch(() => null)) as PublicLinksPayload | null;
    if (!payload || typeof payload !== "object") {
      return null;
    }

    const raw = payload.discordServerUrl;
    if (typeof raw !== "string") {
      return null;
    }

    return resolveOptionalPublicUrl(raw);
  } catch {
    return null;
  }
}

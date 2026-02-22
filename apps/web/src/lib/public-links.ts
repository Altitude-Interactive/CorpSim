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

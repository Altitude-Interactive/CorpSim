function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export const GOOGLE_AUTH_ENABLED = parseBooleanEnv(process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED);

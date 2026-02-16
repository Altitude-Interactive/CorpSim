function parseOptionalBooleanEnv(value: string | undefined): boolean | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
    return false;
  }
  return null;
}

// Show Google auth by default to avoid hidden-login regressions.
// Set NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=false to hide it explicitly.
export const GOOGLE_AUTH_ENABLED =
  parseOptionalBooleanEnv(process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED) ?? true;

// Show GitHub auth by default to avoid hidden-login regressions.
// Set NEXT_PUBLIC_AUTH_GITHUB_ENABLED=false to hide it explicitly.
export const GITHUB_AUTH_ENABLED =
  parseOptionalBooleanEnv(process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED) ?? true;

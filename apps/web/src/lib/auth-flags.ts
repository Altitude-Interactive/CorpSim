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

// Hide Google auth by default unless explicitly enabled.
// Set NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true to show it.
export const GOOGLE_AUTH_ENABLED =
  parseOptionalBooleanEnv(process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED) ?? false;

// Hide GitHub auth by default unless explicitly enabled.
// Set NEXT_PUBLIC_AUTH_GITHUB_ENABLED=true to show it.
export const GITHUB_AUTH_ENABLED =
  parseOptionalBooleanEnv(process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED) ?? false;

// Hide Microsoft auth by default unless explicitly enabled.
// Set NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true to show it.
export const MICROSOFT_AUTH_ENABLED =
  parseOptionalBooleanEnv(process.env.NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED) ?? false;

// Hide Discord auth by default unless explicitly enabled.
// Set NEXT_PUBLIC_AUTH_DISCORD_ENABLED=true to show it.
export const DISCORD_AUTH_ENABLED =
  parseOptionalBooleanEnv(process.env.NEXT_PUBLIC_AUTH_DISCORD_ENABLED) ?? false;

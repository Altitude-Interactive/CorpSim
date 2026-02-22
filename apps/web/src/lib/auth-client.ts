"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient, usernameClient } from "better-auth/client/plugins";
import { isLocalhostHostname, isLocalhostUrl } from "./localhost-utils";

function resolveAuthBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "";
  if (!raw) {
    return "";
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function validateAuthConfiguration(): void {
  if (typeof window === "undefined") {
    return;
  }

  const authUrl =
    process.env.NEXT_PUBLIC_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim();
  const currentHost = window.location.hostname;

  // Skip validation in development
  if (isLocalhostHostname(currentHost)) {
    return;
  }

  if (!authUrl) {
    return;
  }

  if (isLocalhostUrl(authUrl)) {
    console.warn(
      `[CorpSim Auth] Auth base URL is set to "${authUrl}" but you're accessing the site from "${currentHost}". ` +
      "This likely means the environment variable was not set as a build argument. " +
      "Authentication requests may fail. " +
      "Set NEXT_PUBLIC_AUTH_URL (or NEXT_PUBLIC_APP_URL) to your deployed app origin and rebuild the image."
    );
    return;
  }

  try {
    const authHost = new URL(authUrl).hostname;
    if (authHost !== currentHost) {
      console.warn(
        `[CorpSim Auth] Auth base URL host "${authHost}" differs from current host "${currentHost}". ` +
        "For SSO providers that require a single domain, point auth traffic to the same public origin."
      );
    }
  } catch {
    console.warn(
      `[CorpSim Auth] Auth base URL "${authUrl}" is not a valid absolute URL. ` +
      "Use an absolute HTTPS URL, or leave it empty to use same-origin routing."
    );
  }
}

// Run validation once when the module loads (client-side only)
if (typeof window !== "undefined") {
  validateAuthConfiguration();
}

export const authClient = createAuthClient({
  baseURL: resolveAuthBaseUrl(),
  plugins: [
    usernameClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        if (typeof window !== "undefined") {
          window.location.assign("/two-factor");
        }
      }
    }),
    adminClient()
  ]
});


"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, twoFactorClient, usernameClient } from "better-auth/client/plugins";

function resolveAuthBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
  if (!raw) {
    return "";
  }
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function validateAuthConfiguration(): void {
  if (typeof window === "undefined") {
    return;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  const currentHost = window.location.hostname;

  // Skip validation in development
  if (currentHost === "localhost" || currentHost === "127.0.0.1") {
    return;
  }

  // Check if API URL is missing or pointing to localhost in production
  if (!apiUrl) {
    console.warn(
      "[CorpSim Auth] NEXT_PUBLIC_API_URL is not set. Authentication will fail. " +
      "Ensure NEXT_PUBLIC_API_URL is set as a build argument when building the Docker image."
    );
    return;
  }

  if (apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")) {
    console.warn(
      `[CorpSim Auth] NEXT_PUBLIC_API_URL is set to "${apiUrl}" but you're accessing the site from "${currentHost}". ` +
      "This likely means the environment variable was not set as a build argument. " +
      "Authentication requests will fail. " +
      "Set NEXT_PUBLIC_API_URL as a build argument in your deployment platform and rebuild the image."
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


import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if a hostname is localhost (IPv4, IPv6, or literal).
 * @param hostname - The hostname to check
 * @returns true if the hostname is localhost, 127.0.0.1, or ::1
 */
export function isLocalhostHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

/**
 * Checks if a URL points to localhost.
 * @param url - The URL to check
 * @returns true if the URL points to localhost (supports IPv4, IPv6)
 */
export function isLocalhostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return isLocalhostHostname(parsed.hostname);
  } catch {
    // Fallback for non-absolute URLs or invalid URLs
    return (
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("::1")
    );
  }
}

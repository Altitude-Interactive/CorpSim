/**
 * Checks if a hostname is localhost (IPv4, IPv6, or literal).
 * @param hostname - The hostname to check
 * @returns true if the hostname is localhost, 127.0.0.1, or ::1
 */
export function isLocalhostHostname(hostname: string): boolean {
  if (!hostname || !hostname.trim()) return false;

  const normalized = hostname.toLowerCase().trim();

  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  ) {
    return true;
  }

  // Covers other IPv4 loopback addresses like 127.x.x.x
  if (normalized.startsWith("127.")) {
    return true;
  }

  return false;
}

/**
 * Checks if a URL points to localhost.
 * @param url - The URL to check
 * @returns true if the URL points to localhost (supports IPv4, IPv6)
 */
export function isLocalhostUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return isLocalhostHostname(hostname);
  } catch {
    return false;
  }
}

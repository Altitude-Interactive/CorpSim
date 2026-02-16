import { timingSafeEqual } from "node:crypto";

/**
 * Compare two strings in constant time to prevent timing attacks.
 *
 * This function is designed to prevent timing-based side-channel attacks
 * when comparing sensitive strings like authentication tokens or passwords.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 *
 * @example
 * ```typescript
 * const isValid = timingSafeCompare(providedToken, configuredToken);
 * if (!isValid) {
 *   throw new UnauthorizedException('Invalid token');
 * }
 * ```
 */
export function timingSafeCompare(
  a: string | undefined | null,
  b: string | undefined | null
): boolean {
  // Handle null/undefined cases
  if (!a || !b) {
    return false;
  }

  // Ensure equal length to prevent timing leak
  if (a.length !== b.length) {
    return false;
  }

  try {
    const bufA = Buffer.from(a, "utf8");
    const bufB = Buffer.from(b, "utf8");
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

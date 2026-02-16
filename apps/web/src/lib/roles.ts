export type UserRole = "admin" | "moderator";

function normalizeRoles(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function hasRole(raw: string | null | undefined, role: UserRole): boolean {
  return normalizeRoles(raw).some((entry) => entry === role);
}

export function isAdminRole(raw: string | null | undefined): boolean {
  return hasRole(raw, "admin");
}

export function isModeratorRole(raw: string | null | undefined): boolean {
  return hasRole(raw, "moderator");
}

export function isStaffRole(raw: string | null | undefined): boolean {
  return isAdminRole(raw) || isModeratorRole(raw);
}

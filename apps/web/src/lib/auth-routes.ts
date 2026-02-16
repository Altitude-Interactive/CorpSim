const AUTH_PAGES = new Set(["/sign-in", "/sign-up", "/two-factor"]);
const ALWAYS_PUBLIC_PAGES = new Set(["/unsupported-device"]);
const ADMIN_TOOL_PAGES = new Set(["/admin", "/developer"]);
const MODERATION_TOOL_PAGES = new Set(["/moderation"]);

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.has(pathname);
}

export function isAlwaysPublicPage(pathname: string): boolean {
  return ALWAYS_PUBLIC_PAGES.has(pathname);
}

export function isOnboardingPage(pathname: string): boolean {
  return pathname === "/onboarding";
}

export function isTutorialPage(pathname: string): boolean {
  return pathname === "/tutorial";
}

export function isProfilePage(pathname: string): boolean {
  return pathname === "/profile";
}

export function isAdminToolPage(pathname: string): boolean {
  return ADMIN_TOOL_PAGES.has(pathname);
}

export function isModerationToolPage(pathname: string): boolean {
  return MODERATION_TOOL_PAGES.has(pathname);
}

export function isProtectedAppPage(pathname: string): boolean {
  return !isAuthPage(pathname) && !isAlwaysPublicPage(pathname);
}

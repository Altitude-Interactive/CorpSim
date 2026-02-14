const AUTH_PAGES = new Set(["/sign-in", "/sign-up", "/two-factor"]);
const ALWAYS_PUBLIC_PAGES = new Set(["/unsupported-device"]);

export function isAuthPage(pathname: string): boolean {
  return AUTH_PAGES.has(pathname);
}

export function isAlwaysPublicPage(pathname: string): boolean {
  return ALWAYS_PUBLIC_PAGES.has(pathname);
}

export function isOnboardingPage(pathname: string): boolean {
  return pathname === "/onboarding";
}

export function isProfilePage(pathname: string): boolean {
  return pathname === "/profile";
}

export function isProtectedAppPage(pathname: string): boolean {
  return !isAuthPage(pathname) && !isAlwaysPublicPage(pathname);
}


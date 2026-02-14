"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { OnboardingStatus } from "@corpsim/shared";
import { getOnboardingStatus } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import {
  isAuthPage,
  isOnboardingPage,
  isProfilePage,
  isProtectedAppPage
} from "@/lib/auth-routes";

function resolveSafeNextPath(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) {
    return null;
  }
  if (isAuthPage(raw) || isOnboardingPage(raw)) {
    return null;
  }
  return raw;
}

function FullscreenMessage({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function AuthRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPathFromQuery = resolveSafeNextPath(searchParams.get("next"));
  const { data: session, isPending } = authClient.useSession();
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  const [onboardingStatusPathname, setOnboardingStatusPathname] = useState<string | null>(null);
  const [isOnboardingStatusLoading, setOnboardingStatusLoading] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      setOnboardingStatus(null);
      setOnboardingStatusPathname(null);
      setOnboardingStatusLoading(false);
      setOnboardingError(null);
      return;
    }

    let active = true;
    setOnboardingStatusLoading(true);
    setOnboardingStatusPathname(null);
    setOnboardingError(null);
    void getOnboardingStatus()
      .then((status) => {
        if (!active) {
          return;
        }
        setOnboardingStatus(status);
        setOnboardingStatusPathname(pathname);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setOnboardingError(error instanceof Error ? error.message : "Failed to load onboarding status");
      })
      .finally(() => {
        if (active) {
          setOnboardingStatusLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [pathname, session?.user?.id]);

  const redirectTarget = useMemo(() => {
    if (isPending) {
      return null;
    }

    const authenticated = Boolean(session?.user?.id);
    if (!authenticated) {
      if (isProtectedAppPage(pathname)) {
        return `/sign-in?next=${encodeURIComponent(pathname)}`;
      }
      return null;
    }

    if (isOnboardingStatusLoading || onboardingStatusPathname !== pathname || !onboardingStatus) {
      return null;
    }

    if (!onboardingStatus.completed) {
      if (isOnboardingPage(pathname) || isProfilePage(pathname)) {
        return null;
      }
      return "/onboarding";
    }

    if (isAuthPage(pathname) || isOnboardingPage(pathname)) {
      return nextPathFromQuery ?? "/overview";
    }

    return null;
  }, [
    isOnboardingStatusLoading,
    isPending,
    nextPathFromQuery,
    onboardingStatus,
    onboardingStatusPathname,
    pathname,
    session?.user?.id
  ]);

  useEffect(() => {
    if (!redirectTarget || redirectTarget === pathname) {
      return;
    }
    router.replace(redirectTarget);
  }, [pathname, redirectTarget, router]);

  if (isPending) {
    return <FullscreenMessage message="Checking session..." />;
  }

  if (redirectTarget) {
    return <FullscreenMessage message="Redirecting..." />;
  }

  if (session?.user?.id && (isOnboardingStatusLoading || !onboardingStatus)) {
    return <FullscreenMessage message="Loading your company setup..." />;
  }

  if (onboardingError && session?.user?.id && !isProfilePage(pathname)) {
    return <FullscreenMessage message={onboardingError} />;
  }

  return <>{children}</>;
}

"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const MIN_SUPPORTED_WIDTH_PX = 900;
const UNSUPPORTED_DEVICE_ROUTE = "/unsupported-device";
const DEFAULT_SUPPORTED_ROUTE = "/overview";

function readUnsupportedState(mediaQuery: MediaQueryList): boolean {
  return mediaQuery.matches;
}

export function DeviceSupportGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(max-width: ${MIN_SUPPORTED_WIDTH_PX - 1}px)`);
    const onChange = () => {
      setIsUnsupported(readUnsupportedState(mediaQuery));
      setIsReady(true);
    };

    onChange();

    mediaQuery.addEventListener("change", onChange);
    return () => {
      mediaQuery.removeEventListener("change", onChange);
    };
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (isUnsupported && pathname !== UNSUPPORTED_DEVICE_ROUTE) {
      router.replace(UNSUPPORTED_DEVICE_ROUTE);
      return;
    }

    if (!isUnsupported && pathname === UNSUPPORTED_DEVICE_ROUTE) {
      router.replace(DEFAULT_SUPPORTED_ROUTE);
    }
  }, [isReady, isUnsupported, pathname, router]);

  if (isReady && isUnsupported && pathname !== UNSUPPORTED_DEVICE_ROUTE) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <p className="text-sm text-muted-foreground">Redirecting to a supported device notice...</p>
      </div>
    );
  }

  return <>{children}</>;
}


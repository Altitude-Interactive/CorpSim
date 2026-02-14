"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ToastOverlay } from "@/components/ui/toast-manager";
import { getMePlayer, type PlayerIdentity } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { useControlManager } from "./control-manager";

export const PROFILE_PANEL_ID = "profile-panel";

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString();
}

function readErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to load profile details right now.";
}

export function ProfilePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { isPanelOpen, openPanel, closePanel } = useControlManager();
  const { data: session } = authClient.useSession();
  const open = isPanelOpen(PROFILE_PANEL_ID);
  const [player, setPlayer] = useState<PlayerIdentity | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [isSigningOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getMePlayer();
      setPlayer(next);
    } catch (caught) {
      setError(readErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (new URLSearchParams(window.location.search).get("panel") !== "profile") {
      return;
    }
    openPanel(PROFILE_PANEL_ID);
    router.replace(pathname, { scroll: false });
  }, [openPanel, pathname, router]);

  useEffect(() => {
    closePanel(PROFILE_PANEL_ID);
  }, [closePanel, pathname]);

  useEffect(() => {
    if (!open || !session?.user?.id) {
      return;
    }
    void loadProfile();
  }, [loadProfile, open, session?.user?.id]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closePanel(PROFILE_PANEL_ID);
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [closePanel, open]);

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) {
      return;
    }

    setSigningOut(true);
    setError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(result.error.message || "Sign out failed.");
        return;
      }
      closePanel(PROFILE_PANEL_ID);
      router.replace("/sign-in");
      router.refresh();
    } catch (caught) {
      setError(readErrorMessage(caught));
    } finally {
      setSigningOut(false);
    }
  }, [closePanel, isSigningOut, router]);

  if (!open) {
    return null;
  }

  return (
    <ToastOverlay
      backdrop="solid"
      variant="default"
      layerClassName="z-[9700] p-4 sm:p-8"
      panelClassName="max-w-xl p-0"
      onBackdropMouseDown={() => closePanel(PROFILE_PANEL_ID)}
      labelledBy="profile-panel-title"
      describedBy="profile-panel-description"
    >
      <header className="border-b border-border px-4 py-4">
        <h2 id="profile-panel-title" className="text-lg font-semibold text-slate-100">
          Profile
        </h2>
        <p id="profile-panel-description" className="mt-1 text-sm text-slate-300">
          Review your account details and sign out.
        </p>
      </header>

      <div className="space-y-3 px-4 py-4 text-sm">
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <div className="rounded-md border border-border/70 bg-background/40 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Account Email</p>
          <p className="mt-1 font-medium">{session?.user?.email ?? "-"}</p>
        </div>
        <div className="rounded-md border border-border/70 bg-background/40 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Player Handle</p>
          <p className="mt-1 font-medium">{isLoading ? "Loading..." : player?.handle ?? "-"}</p>
        </div>
        <div className="rounded-md border border-border/70 bg-background/40 p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Joined</p>
          <p className="mt-1 font-medium">{isLoading ? "Loading..." : formatDate(player?.createdAt)}</p>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
        <Button type="button" variant="outline" onClick={() => closePanel(PROFILE_PANEL_ID)}>
          Close
        </Button>
        <Button type="button" variant="destructive" onClick={() => void handleSignOut()} disabled={isSigningOut}>
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </Button>
      </footer>
    </ToastOverlay>
  );
}

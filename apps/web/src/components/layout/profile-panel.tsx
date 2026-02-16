"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ToastOverlay, useToast } from "@/components/ui/toast-manager";
import { GoogleLogo } from "@/components/auth/google-logo";
import { GitHubLogo } from "@/components/auth/github-logo";
import { MicrosoftLogo } from "@/components/auth/microsoft-logo";
import { DiscordLogo } from "@/components/auth/discord-logo";
import { getMePlayer, type PlayerIdentity } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { readBetterAuthErrorFromParams, resolveBetterAuthErrorMessage } from "@/lib/better-auth-errors";
import { resolveAuthCallbackUrl } from "@/lib/auth-redirects";
import { GOOGLE_AUTH_ENABLED, GITHUB_AUTH_ENABLED, MICROSOFT_AUTH_ENABLED, DISCORD_AUTH_ENABLED } from "@/lib/auth-flags";
import { useControlManager } from "./control-manager";

export const PROFILE_PANEL_ID = "profile-panel";

type LinkedAccount = {
  providerId: string;
  accountId: string;
};

type ProviderConfig = {
  id: string;
  name: string;
  logo: React.ComponentType<{ className?: string }>;
  enabled: boolean;
};

const OAUTH_PROVIDERS: ProviderConfig[] = [
  { id: "google", name: "Google", logo: GoogleLogo, enabled: GOOGLE_AUTH_ENABLED },
  { id: "github", name: "GitHub", logo: GitHubLogo, enabled: GITHUB_AUTH_ENABLED },
  { id: "microsoft", name: "Microsoft", logo: MicrosoftLogo, enabled: MICROSOFT_AUTH_ENABLED },
  { id: "discord", name: "Discord", logo: DiscordLogo, enabled: DISCORD_AUTH_ENABLED }
].filter(p => p.enabled);

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

function isAdminRole(role: string | null | undefined): boolean {
  if (!role) {
    return false;
  }
  return role
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .some((entry) => entry === "admin");
}

export function ProfilePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();
  const { isPanelOpen, openPanel, closePanel } = useControlManager();
  const { data: session } = authClient.useSession();
  const open = isPanelOpen(PROFILE_PANEL_ID);
  const isAdmin = isAdminRole(session?.user?.role);
  const [player, setPlayer] = useState<PlayerIdentity | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [isLoadingAccounts, setLoadingAccounts] = useState(false);
  const [isSigningOut, setSigningOut] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const lastAuthErrorRef = useRef<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getMePlayer();
      setPlayer(next);
    } catch (caught) {
      showToast({
        title: "Profile load failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setLinkedAccounts([]); // Clear existing accounts while loading
    try {
      const result = await authClient.listAccounts();
      if (result.data) {
        setLinkedAccounts(result.data.map(acc => ({ providerId: acc.providerId, accountId: acc.accountId || "" })));
      } else if (result.error) {
        console.error("Failed to load accounts:", result.error);
        setLinkedAccounts([]); // Clear on error
        showToast({
          title: "Account list failed",
          description: result.error.message || "Unable to load linked accounts.",
          variant: "error"
        });
      }
    } catch (caught) {
      console.error("Failed to load accounts:", caught);
      setLinkedAccounts([]); // Clear on exception
      showToast({
        title: "Account list failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setLoadingAccounts(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const authError = readBetterAuthErrorFromParams(params);
    const hasPanelParam = params.get("panel") === "profile";

    if (authError) {
      const signature = `${authError.error}:${authError.description ?? ""}`;
      if (lastAuthErrorRef.current === signature) {
        return;
      }
      lastAuthErrorRef.current = signature;
      showToast({
        title: "Account linking failed",
        description: resolveBetterAuthErrorMessage(authError.error, authError.description),
        variant: "error"
      });

      if (!hasPanelParam) {
        params.set("panel", "profile");
      }

      params.delete("error");
      params.delete("error_description");
      const cleanUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      openPanel(PROFILE_PANEL_ID);
      router.replace(cleanUrl, { scroll: false });
      return;
    }

    lastAuthErrorRef.current = null;

    if (!hasPanelParam) {
      return;
    }
    openPanel(PROFILE_PANEL_ID);
    const cleanUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(cleanUrl, { scroll: false });
  }, [openPanel, pathname, router, showToast]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("panel") === "profile") {
      return;
    }
    closePanel(PROFILE_PANEL_ID);
  }, [closePanel, pathname]);

  useEffect(() => {
    if (!open || !session?.user?.id) {
      return;
    }
    void loadProfile();
    void loadAccounts();
  }, [loadProfile, loadAccounts, open, session?.user?.id]);

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
    try {
      const result = await authClient.signOut();
      if (result.error) {
        showToast({
          title: "Sign out failed",
          description: result.error.message || "Unable to sign out right now.",
          variant: "error"
        });
        return;
      }
      closePanel(PROFILE_PANEL_ID);
      router.replace("/sign-in");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Sign out failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setSigningOut(false);
    }
  }, [closePanel, isSigningOut, router, showToast]);

  const handleLinkAccount = useCallback(async (provider: string) => {
    if (isAdmin) {
      showToast({
        title: "Linking unavailable",
        description: "Admin accounts cannot link external providers.",
        variant: "warning"
      });
      return;
    }

    if (linkingProvider || unlinkingProvider) {
      return;
    }

    setLinkingProvider(provider);

    try {
      const currentPath = window.location.pathname;
      const callbackPath = `${currentPath}?panel=profile`;
      const result = await authClient.linkSocial({
        provider,
        callbackURL: resolveAuthCallbackUrl(callbackPath),
        errorCallbackURL: resolveAuthCallbackUrl(callbackPath)
      });

      if (result.error) {
        showToast({
          title: "Account linking failed",
          description: result.error.message || `Failed to link ${provider} account.`,
          variant: "error"
        });
        return;
      }

      if (result.data?.url) {
        window.location.assign(result.data.url);
      }
    } catch (caught) {
      showToast({
        title: "Account linking failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setLinkingProvider(null);
    }
  }, [isAdmin, linkingProvider, unlinkingProvider, showToast]);

  const handleUnlinkAccount = useCallback(async (provider: string, accountId: string) => {
    if (linkingProvider || unlinkingProvider) {
      return;
    }

    // Check if this is the last account and user has no password
    const hasEmailPassword = linkedAccounts.some(acc => acc.providerId === "credential");
    if (linkedAccounts.length === 1 && !hasEmailPassword) {
      showToast({
        title: "Cannot unlink account",
        description: "Please link another account or set a password first.",
        variant: "warning"
      });
      return;
    }

    if (!confirm(`Are you sure you want to unlink your ${provider} account?`)) {
      return;
    }

    setUnlinkingProvider(provider);

    try {
      const result = await authClient.unlinkAccount({
        providerId: provider,
        accountId
      });

      if (result.error) {
        showToast({
          title: "Account unlink failed",
          description: result.error.message || `Failed to unlink ${provider} account.`,
          variant: "error"
        });
        return;
      }

      // Refresh the accounts list
      await loadAccounts();
    } catch (caught) {
      showToast({
        title: "Account unlink failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setUnlinkingProvider(null);
    }
  }, [linkedAccounts, linkingProvider, unlinkingProvider, loadAccounts, showToast]);

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
          Review your account details, manage linked accounts, and sign out.
        </p>
      </header>

      <div className="space-y-3 px-4 py-4 text-sm">
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

        {/* Linked Accounts Section */}
        {OAUTH_PROVIDERS.length > 0 ? (
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Linked Accounts</p>
            {isAdmin ? (
              <p className="mb-3 text-xs text-muted-foreground">
                Admin accounts cannot link external providers.
              </p>
            ) : null}
            {isLoadingAccounts ? (
              <p className="text-xs text-muted-foreground">Loading accounts...</p>
            ) : (
              <div className="space-y-2">
                {OAUTH_PROVIDERS.map((provider) => {
                  const isLinked = linkedAccounts.some(acc => acc.providerId === provider.id);
                  const account = linkedAccounts.find(acc => acc.providerId === provider.id);
                  const Logo = provider.logo;
                  const isLinking = linkingProvider === provider.id;
                  const isUnlinking = unlinkingProvider === provider.id;

                  return (
                    <div key={provider.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <Logo className="size-4 shrink-0" />
                        <span className="text-sm font-medium">{provider.name}</span>
                        {isLinked ? (
                          <span className="text-xs text-green-400">✓ Connected</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not connected</span>
                        )}
                      </div>
                      {isLinked ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => account && void handleUnlinkAccount(provider.id, account.accountId)}
                          disabled={isUnlinking || isLinking || linkedAccounts.length === 1}
                        >
                          {isUnlinking ? "Unlinking..." : "Unlink"}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => void handleLinkAccount(provider.id)}
                          disabled={isLinking || isUnlinking || isAdmin}
                        >
                          {isLinking ? "Linking..." : "Link"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ToastOverlay } from "@/components/ui/toast-manager";
import { GoogleLogo } from "@/components/auth/google-logo";
import { GitHubLogo } from "@/components/auth/github-logo";
import { MicrosoftLogo } from "@/components/auth/microsoft-logo";
import { DiscordLogo } from "@/components/auth/discord-logo";
import { getMePlayer, type PlayerIdentity } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
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

export function ProfilePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { isPanelOpen, openPanel, closePanel } = useControlManager();
  const { data: session } = authClient.useSession();
  const open = isPanelOpen(PROFILE_PANEL_ID);
  const [player, setPlayer] = useState<PlayerIdentity | null>(null);
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [isLoadingAccounts, setLoadingAccounts] = useState(false);
  const [isSigningOut, setSigningOut] = useState(false);
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
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

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const result = await authClient.listAccounts();
      if (result.data) {
        setLinkedAccounts(result.data.map(acc => ({ providerId: acc.providerId, accountId: acc.accountId || "" })));
      } else if (result.error) {
        console.error("Failed to load accounts:", result.error);
      }
    } catch (caught) {
      console.error("Failed to load accounts:", caught);
    } finally {
      setLoadingAccounts(false);
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

  const handleLinkAccount = useCallback(async (provider: string) => {
    if (linkingProvider || unlinkingProvider) {
      return;
    }

    setLinkingProvider(provider);
    setError(null);

    try {
      const result = await authClient.linkSocial({
        provider,
        callbackURL: window.location.pathname + "?panel=profile"
      });

      if (result.error) {
        setError(result.error.message || `Failed to link ${provider} account.`);
        return;
      }

      if (result.data?.url) {
        window.location.assign(result.data.url);
      }
    } catch (caught) {
      setError(readErrorMessage(caught));
    } finally {
      setLinkingProvider(null);
    }
  }, [linkingProvider, unlinkingProvider]);

  const handleUnlinkAccount = useCallback(async (provider: string, accountId: string) => {
    if (linkingProvider || unlinkingProvider) {
      return;
    }

    // Check if this is the last account and user has no password
    const hasEmailPassword = linkedAccounts.some(acc => acc.providerId === "credential");
    if (linkedAccounts.length === 1 && !hasEmailPassword) {
      setError("Cannot unlink your only account. Please link another account or set a password first.");
      return;
    }

    if (!confirm(`Are you sure you want to unlink your ${provider} account?`)) {
      return;
    }

    setUnlinkingProvider(provider);
    setError(null);

    try {
      const result = await authClient.unlinkAccount({
        providerId: provider,
        accountId
      });

      if (result.error) {
        setError(result.error.message || `Failed to unlink ${provider} account.`);
        return;
      }

      // Refresh the accounts list
      await loadAccounts();
    } catch (caught) {
      setError(readErrorMessage(caught));
    } finally {
      setUnlinkingProvider(null);
    }
  }, [linkedAccounts, linkingProvider, unlinkingProvider, loadAccounts]);

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

        {/* Linked Accounts Section */}
        {OAUTH_PROVIDERS.length > 0 ? (
          <div className="rounded-md border border-border/70 bg-background/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Linked Accounts</p>
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
                          disabled={isLinking || isUnlinking}
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

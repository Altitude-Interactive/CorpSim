"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { getMePlayer, type PlayerIdentity } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

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

export default function ProfilePage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [player, setPlayer] = useState<PlayerIdentity | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isSigningOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getMePlayer()
      .then((value) => {
        if (active) {
          setPlayer(value);
        }
      })
      .catch((caught) => {
        if (active) {
          setError(readErrorMessage(caught));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
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
      router.replace("/sign-in");
      router.refresh();
    } catch (caught) {
      setError(readErrorMessage(caught));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <AuthPageShell
      title="Profile"
      description="Review your account and player identity details."
      footer={
        <div className="flex items-center justify-between gap-3">
          <Link href="/overview" className="text-muted-foreground hover:text-foreground hover:underline">
            Back to dashboard
          </Link>
          <Button variant="outline" onClick={() => void handleSignOut()} disabled={isSigningOut}>
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </Button>
        </div>
      }
    >
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <div className="space-y-3 text-sm">
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
    </AuthPageShell>
  );
}


"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-manager";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { GoogleLogo } from "@/components/auth/google-logo";
import { GitHubLogo } from "@/components/auth/github-logo";
import { MicrosoftLogo } from "@/components/auth/microsoft-logo";
import { DiscordLogo } from "@/components/auth/discord-logo";
import { authClient } from "@/lib/auth-client";
import { readBetterAuthErrorFromParams, resolveBetterAuthErrorMessage } from "@/lib/better-auth-errors";
import { resolveAuthCallbackUrl } from "@/lib/auth-redirects";
import { GOOGLE_AUTH_ENABLED, GITHUB_AUTH_ENABLED, MICROSOFT_AUTH_ENABLED, DISCORD_AUTH_ENABLED } from "@/lib/auth-flags";
import { isAuthPage, isOnboardingPage, isTutorialPage } from "@/lib/auth-routes";

function resolveSafeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) {
    return null;
  }
  if (isAuthPage(raw) || isOnboardingPage(raw) || isTutorialPage(raw)) {
    return null;
  }
  return raw;
}

function readErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to sign in. Please check your details and try again.";
}

export default function SignInPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const nextPath = useMemo(() => resolveSafeNext(searchParams.get("next")), [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isGoogleSubmitting, setGoogleSubmitting] = useState(false);
  const [isGitHubSubmitting, setGitHubSubmitting] = useState(false);
  const [isMicrosoftSubmitting, setMicrosoftSubmitting] = useState(false);
  const [isDiscordSubmitting, setDiscordSubmitting] = useState(false);

  useEffect(() => {
    const authError = readBetterAuthErrorFromParams(searchParams);
    if (!authError) {
      return;
    }

    showToast({
      title: "Sign-in failed",
      description: resolveBetterAuthErrorMessage(authError.error, authError.description),
      variant: "error"
    });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("error");
    params.delete("error_description");
    const cleanUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(cleanUrl);
  }, [pathname, router, searchParams, showToast]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setSubmitting(true);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        rememberMe,
        callbackURL: nextPath ?? undefined
      });

      if (result.error) {
        showToast({
          title: "Sign-in failed",
          description: result.error.message || "Sign-in failed.",
          variant: "error"
        });
        return;
      }

      const redirectUrl =
        result.data && typeof result.data === "object" && "url" in result.data && typeof result.data.url === "string"
          ? result.data.url
          : null;

      if (redirectUrl && redirectUrl.length > 0) {
        window.location.assign(redirectUrl);
        return;
      }

      router.replace(nextPath ?? "/overview");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Sign-in failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting) {
      return;
    }

    setGoogleSubmitting(true);

    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      params.delete("error_description");
      const errorCallbackUrl = resolveAuthCallbackUrl(
        `/sign-in${params.toString() ? `?${params.toString()}` : ""}`
      );
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: resolveAuthCallbackUrl(nextPath ?? "/overview"),
        errorCallbackURL: errorCallbackUrl
      });

      if (result.error) {
        showToast({
          title: "Google sign-in failed",
          description: result.error.message || "Google sign-in failed.",
          variant: "error"
        });
        return;
      }

      const redirectUrl =
        result.data && typeof result.data === "object" && "url" in result.data && typeof result.data.url === "string"
          ? result.data.url
          : null;

      if (redirectUrl && redirectUrl.length > 0) {
        window.location.assign(redirectUrl);
        return;
      }

      router.replace(nextPath ?? "/overview");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Google sign-in failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleGitHubSignIn() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting) {
      return;
    }

    setGitHubSubmitting(true);

    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      params.delete("error_description");
      const errorCallbackUrl = resolveAuthCallbackUrl(
        `/sign-in${params.toString() ? `?${params.toString()}` : ""}`
      );
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: resolveAuthCallbackUrl(nextPath ?? "/overview"),
        errorCallbackURL: errorCallbackUrl
      });

      if (result.error) {
        showToast({
          title: "GitHub sign-in failed",
          description: result.error.message || "GitHub sign-in failed.",
          variant: "error"
        });
        return;
      }

      const redirectUrl =
        result.data && typeof result.data === "object" && "url" in result.data && typeof result.data.url === "string"
          ? result.data.url
          : null;

      if (redirectUrl && redirectUrl.length > 0) {
        window.location.assign(redirectUrl);
        return;
      }

      router.replace(nextPath ?? "/overview");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "GitHub sign-in failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setGitHubSubmitting(false);
    }
  }

  async function handleMicrosoftSignIn() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting) {
      return;
    }

    setMicrosoftSubmitting(true);

    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      params.delete("error_description");
      const errorCallbackUrl = resolveAuthCallbackUrl(
        `/sign-in${params.toString() ? `?${params.toString()}` : ""}`
      );
      const result = await authClient.signIn.social({
        provider: "microsoft",
        callbackURL: resolveAuthCallbackUrl(nextPath ?? "/overview"),
        errorCallbackURL: errorCallbackUrl
      });

      if (result.error) {
        showToast({
          title: "Microsoft sign-in failed",
          description: result.error.message || "Microsoft sign-in failed.",
          variant: "error"
        });
        return;
      }

      const redirectUrl =
        result.data && typeof result.data === "object" && "url" in result.data && typeof result.data.url === "string"
          ? result.data.url
          : null;

      if (redirectUrl && redirectUrl.length > 0) {
        window.location.assign(redirectUrl);
        return;
      }

      router.replace(nextPath ?? "/overview");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Microsoft sign-in failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setMicrosoftSubmitting(false);
    }
  }

  async function handleDiscordSignIn() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting) {
      return;
    }

    setDiscordSubmitting(true);

    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("error");
      params.delete("error_description");
      const errorCallbackUrl = resolveAuthCallbackUrl(
        `/sign-in${params.toString() ? `?${params.toString()}` : ""}`
      );
      const result = await authClient.signIn.social({
        provider: "discord",
        callbackURL: resolveAuthCallbackUrl(nextPath ?? "/overview"),
        errorCallbackURL: errorCallbackUrl
      });

      if (result.error) {
        showToast({
          title: "Discord sign-in failed",
          description: result.error.message || "Discord sign-in failed.",
          variant: "error"
        });
        return;
      }

      const redirectUrl =
        result.data && typeof result.data === "object" && "url" in result.data && typeof result.data.url === "string"
          ? result.data.url
          : null;

      if (redirectUrl && redirectUrl.length > 0) {
        window.location.assign(redirectUrl);
        return;
      }

      router.replace(nextPath ?? "/overview");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Discord sign-in failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setDiscordSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      title="Sign In"
      description="Access your company dashboard."
      footer={
        <p className="text-muted-foreground">
          New here?{" "}
          <Link href="/sign-up" className="font-medium text-foreground hover:underline">
            Create an account
          </Link>
        </p>
      }
    >
      <div className="space-y-3">
        {GOOGLE_AUTH_ENABLED ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleGoogleSignIn()}
              disabled={isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting}
            >
              <span className="inline-flex items-center gap-2">
                <GoogleLogo className="size-4 shrink-0" />
                {isGoogleSubmitting ? "Redirecting to Google..." : "Continue with Google"}
              </span>
            </Button>
          </>
        ) : null}
        {GITHUB_AUTH_ENABLED ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleGitHubSignIn()}
              disabled={isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting}
            >
              <span className="inline-flex items-center gap-2">
                <GitHubLogo className="size-4 shrink-0" />
                {isGitHubSubmitting ? "Redirecting to GitHub..." : "Continue with GitHub"}
              </span>
            </Button>
          </>
        ) : null}
        {MICROSOFT_AUTH_ENABLED ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleMicrosoftSignIn()}
              disabled={isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting}
            >
              <span className="inline-flex items-center gap-2">
                <MicrosoftLogo className="size-4 shrink-0" />
                {isMicrosoftSubmitting ? "Redirecting to Microsoft..." : "Continue with Microsoft"}
              </span>
            </Button>
          </>
        ) : null}
        {DISCORD_AUTH_ENABLED ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => void handleDiscordSignIn()}
              disabled={isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting}
            >
              <span className="inline-flex items-center gap-2">
                <DiscordLogo className="size-4 shrink-0" />
                {isDiscordSubmitting ? "Redirecting to Discord..." : "Continue with Discord"}
              </span>
            </Button>
          </>
        ) : null}
        {GOOGLE_AUTH_ENABLED || GITHUB_AUTH_ENABLED || MICROSOFT_AUTH_ENABLED || DISCORD_AUTH_ENABLED ? (
          <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">Or continue with email</p>
        ) : null}
      <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm text-muted-foreground">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm text-muted-foreground">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          Keep me signed in
        </label>
        <Button type="submit" className="w-full" disabled={isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>
      </div>
    </AuthPageShell>
  );
}

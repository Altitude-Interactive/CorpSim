"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { GoogleLogo } from "@/components/auth/google-logo";
import { GitHubLogo } from "@/components/auth/github-logo";
import { MicrosoftLogo } from "@/components/auth/microsoft-logo";
import { authClient } from "@/lib/auth-client";
import { resolveAuthCallbackUrl } from "@/lib/auth-redirects";
import { GOOGLE_AUTH_ENABLED, GITHUB_AUTH_ENABLED, MICROSOFT_AUTH_ENABLED } from "@/lib/auth-flags";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => resolveSafeNext(searchParams.get("next")), [searchParams]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isGoogleSubmitting, setGoogleSubmitting] = useState(false);
  const [isGitHubSubmitting, setGitHubSubmitting] = useState(false);
  const [isMicrosoftSubmitting, setMicrosoftSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        rememberMe,
        callbackURL: nextPath ?? undefined
      });

      if (result.error) {
        setError(result.error.message || "Sign-in failed.");
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
      setError(readErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting) {
      return;
    }

    setGoogleSubmitting(true);
    setError(null);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: resolveAuthCallbackUrl(nextPath ?? "/overview")
      });

      if (result.error) {
        setError(result.error.message || "Google sign-in failed.");
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
      setError(readErrorMessage(caught));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleGitHubSignIn() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting) {
      return;
    }

    setGitHubSubmitting(true);
    setError(null);

    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: resolveAuthCallbackUrl(nextPath ?? "/overview")
      });

      if (result.error) {
        setError(result.error.message || "GitHub sign-in failed.");
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
      setError(readErrorMessage(caught));
    } finally {
      setGitHubSubmitting(false);
    }
  }

  async function handleMicrosoftSignIn() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting) {
      return;
    }

    setMicrosoftSubmitting(true);
    setError(null);

    try {
      const result = await authClient.signIn.social({
        provider: "microsoft",
        callbackURL: resolveAuthCallbackUrl(nextPath ?? "/overview")
      });

      if (result.error) {
        setError(result.error.message || "Microsoft sign-in failed.");
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
      setError(readErrorMessage(caught));
    } finally {
      setMicrosoftSubmitting(false);
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
              disabled={isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting}
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
              disabled={isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting}
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
              disabled={isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting}
            >
              <span className="inline-flex items-center gap-2">
                <MicrosoftLogo className="size-4 shrink-0" />
                {isMicrosoftSubmitting ? "Redirecting to Microsoft..." : "Continue with Microsoft"}
              </span>
            </Button>
          </>
        ) : null}
        {GOOGLE_AUTH_ENABLED || GITHUB_AUTH_ENABLED || MICROSOFT_AUTH_ENABLED ? (
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
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>
      </div>
    </AuthPageShell>
  );
}

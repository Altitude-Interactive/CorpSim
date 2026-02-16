"use client";

import { FormEvent, useEffect, useState } from "react";
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

function readErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to create your account right now. Please try again.";
}

export default function SignUpPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
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
      title: "Sign-up failed",
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

    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();
    const trimmedUsername = username.trim();

    if (trimmedEmail.length === 0 && trimmedUsername.length === 0) {
      showToast({
        title: "Sign-up failed",
        description: "Please provide an email or username to continue.",
        variant: "error"
      });
      return;
    }

    if (trimmedEmail.toLowerCase().endsWith("@corpsim.local")) {
      showToast({
        title: "Sign-up failed",
        description: "The @corpsim.local email domain is reserved.",
        variant: "error"
      });
      return;
    }

    setSubmitting(true);

    try {
      const resolvedEmail =
        trimmedEmail.length > 0 ? trimmedEmail : `${trimmedUsername.toLowerCase()}@corpsim.local`;
      const fallbackNameSeed = trimmedUsername || resolvedEmail.split("@")[0] || "Player";
      const result = await authClient.signUp.email({
        email: resolvedEmail,
        password,
        name: trimmedName.length > 0 ? trimmedName : fallbackNameSeed,
        username: trimmedUsername.length > 0 ? trimmedUsername : undefined
      });

      if (result.error) {
        showToast({
          title: "Sign-up failed",
          description: result.error.message || "Sign-up failed.",
          variant: "error"
        });
        return;
      }

      router.replace("/onboarding");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Sign-up failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignUp() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting) {
      return;
    }

    setGoogleSubmitting(true);

    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: resolveAuthCallbackUrl("/onboarding"),
        errorCallbackURL: resolveAuthCallbackUrl("/sign-up")
      });

      if (result.error) {
        showToast({
          title: "Google sign-up failed",
          description: result.error.message || "Google sign-up failed.",
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

      router.replace("/onboarding");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Google sign-up failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setGoogleSubmitting(false);
    }
  }

  async function handleGitHubSignUp() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting) {
      return;
    }

    setGitHubSubmitting(true);

    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: resolveAuthCallbackUrl("/onboarding"),
        errorCallbackURL: resolveAuthCallbackUrl("/sign-up")
      });

      if (result.error) {
        showToast({
          title: "GitHub sign-up failed",
          description: result.error.message || "GitHub sign-up failed.",
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

      router.replace("/onboarding");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "GitHub sign-up failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setGitHubSubmitting(false);
    }
  }

  async function handleMicrosoftSignUp() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting) {
      return;
    }

    setMicrosoftSubmitting(true);

    try {
      const result = await authClient.signIn.social({
        provider: "microsoft",
        callbackURL: resolveAuthCallbackUrl("/onboarding"),
        errorCallbackURL: resolveAuthCallbackUrl("/sign-up")
      });

      if (result.error) {
        showToast({
          title: "Microsoft sign-up failed",
          description: result.error.message || "Microsoft sign-up failed.",
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

      router.replace("/onboarding");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Microsoft sign-up failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setMicrosoftSubmitting(false);
    }
  }

  async function handleDiscordSignUp() {
    if (isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting) {
      return;
    }

    setDiscordSubmitting(true);

    try {
      const result = await authClient.signIn.social({
        provider: "discord",
        callbackURL: resolveAuthCallbackUrl("/onboarding"),
        errorCallbackURL: resolveAuthCallbackUrl("/sign-up")
      });

      if (result.error) {
        showToast({
          title: "Discord sign-up failed",
          description: result.error.message || "Discord sign-up failed.",
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

      router.replace("/onboarding");
      router.refresh();
    } catch (caught) {
      showToast({
        title: "Discord sign-up failed",
        description: readErrorMessage(caught),
        variant: "error"
      });
    } finally {
      setDiscordSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      title="Create Account"
      description="Use an email, a username, or both before creating your first company."
      footer={
        <p className="text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-foreground hover:underline">
            Sign in
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
              onClick={() => void handleGoogleSignUp()}
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
              onClick={() => void handleGitHubSignUp()}
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
              onClick={() => void handleMicrosoftSignUp()}
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
              onClick={() => void handleDiscordSignUp()}
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
          <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">Or create with credentials</p>
        ) : null}
        <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-1.5">
            <label htmlFor="sign-up-email" className="text-sm text-muted-foreground">
              Email (optional if you use a username)
            </label>
            <Input
              id="sign-up-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sign-up-name" className="text-sm text-muted-foreground">
              Display name
            </label>
            <Input
              id="sign-up-name"
              autoComplete="name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="How you appear in your profile"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sign-up-username" className="text-sm text-muted-foreground">
              Username (optional)
            </label>
            <Input
              id="sign-up-username"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Used to generate your player handle"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="sign-up-password" className="text-sm text-muted-foreground">
              Password
            </label>
            <Input
              id="sign-up-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || isGoogleSubmitting || isGitHubSubmitting || isMicrosoftSubmitting || isDiscordSubmitting}
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </Button>
        </form>
      </div>
    </AuthPageShell>
  );
}

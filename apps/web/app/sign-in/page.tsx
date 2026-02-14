"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { authClient } from "@/lib/auth-client";
import { isAuthPage, isOnboardingPage } from "@/lib/auth-routes";

function resolveSafeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/")) {
    return null;
  }
  if (isAuthPage(raw) || isOnboardingPage(raw)) {
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
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </AuthPageShell>
  );
}

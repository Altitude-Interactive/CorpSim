"use client";

import { FormEvent, useMemo, useState } from "react";
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
  return "Unable to verify the code. Please try again.";
}

export default function TwoFactorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => resolveSafeNext(searchParams.get("next")), [searchParams]);
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
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
      const result = await authClient.twoFactor.verifyTotp({
        code: code.trim(),
        trustDevice
      });

      if (result.error) {
        setError(result.error.message || "Invalid code.");
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
      title="Two-Factor Check"
      description="Enter the 6-digit code from your authenticator app."
    >
      <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <div className="space-y-1.5">
          <label htmlFor="two-factor-code" className="text-sm text-muted-foreground">
            Verification code
          </label>
          <Input
            id="two-factor-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="123456"
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={trustDevice}
            onChange={(event) => setTrustDevice(event.target.checked)}
          />
          Trust this device for future sign-ins
        </label>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Verifying..." : "Verify Code"}
        </Button>
      </form>
    </AuthPageShell>
  );
}


"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { authClient } from "@/lib/auth-client";

function readErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to create your account right now. Please try again.";
}

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();
    const trimmedUsername = username.trim();

    setSubmitting(true);
    setError(null);

    try {
      const result = await authClient.signUp.email({
        email: trimmedEmail,
        password,
        name: trimmedName.length > 0 ? trimmedName : trimmedEmail.split("@")[0] || "Player",
        username: trimmedUsername.length > 0 ? trimmedUsername : undefined
      });

      if (result.error) {
        setError(result.error.message || "Sign-up failed.");
        return;
      }

      router.replace("/onboarding");
      router.refresh();
    } catch (caught) {
      setError(readErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPageShell
      title="Create Account"
      description="Set up your login before creating your first company."
      footer={
        <p className="text-muted-foreground">
          Already have an account?{" "}
          <Link href="/sign-in" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <div className="space-y-1.5">
          <label htmlFor="sign-up-email" className="text-sm text-muted-foreground">
            Email
          </label>
          <Input
            id="sign-up-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            required
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
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create Account"}
        </Button>
      </form>
    </AuthPageShell>
  );
}


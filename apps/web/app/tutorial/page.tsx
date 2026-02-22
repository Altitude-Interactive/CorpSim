"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { completeOnboardingTutorial, getOnboardingStatus } from "@/lib/api";
import { getDocumentationUrl } from "@/lib/ui-copy";

const GUIDED_TUTORIAL_TOTAL_STEPS = 8;

function readErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to finish the tutorial right now. Please try again.";
}

export default function TutorialPage() {
  const router = useRouter();
  const [isLoading, setLoading] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    void getOnboardingStatus()
      .then((status) => {
        if (!active) {
          return;
        }

        if (!status.completed) {
          router.replace("/onboarding");
          return;
        }

        if (status.tutorialCompleted) {
          router.replace("/overview");
        }
      })
      .catch((caught) => {
        if (!active) {
          return;
        }
        setError(readErrorMessage(caught));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSkipTutorial() {
    if (isSubmitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await completeOnboardingTutorial();
      router.replace("/overview");
      router.refresh();
    } catch (caught) {
      setError(readErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  function handleStartTour() {
    router.replace("/overview?tutorial=1&tutorialStep=0");
  }

  if (isLoading) {
    return (
      <AuthPageShell title="Guided Tutorial" description="Loading your walkthrough...">
        <p className="text-sm text-muted-foreground">Preparing your first guided steps.</p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title="Guided Tutorial"
      description="A short in-app walkthrough will guide you across the pages you need first."
      footer={
        <a
          href={getDocumentationUrl()}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Open full documentation
        </a>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2 rounded-lg border border-border/70 bg-background/40 p-4">
          <h2 className="text-lg font-semibold tracking-tight">What to expect</h2>
          <p className="text-sm text-muted-foreground">
            You will be guided through Overview, Market, Production, and Inventory with focused
            highlights on the exact sections that matter first.
          </p>
          <ul className="space-y-1 text-sm text-foreground/90">
            <li>- {GUIDED_TUTORIAL_TOTAL_STEPS} short guided steps across core pages.</li>
            <li>- Each step highlights one UI section and tells you what to do there.</li>
            <li>- You can skip now and still continue directly to the dashboard.</li>
          </ul>
        </div>

        {error ? <Alert variant="destructive">{error}</Alert> : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => void handleSkipTutorial()} disabled={isSubmitting}>
            {isSubmitting ? "Skipping..." : "Skip for now"}
          </Button>
          <Button type="button" onClick={handleStartTour} disabled={isSubmitting}>
            Start guided tour
          </Button>
        </div>
      </div>
    </AuthPageShell>
  );
}

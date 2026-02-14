"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { completeOnboardingTutorial, getOnboardingStatus } from "@/lib/api";
import { getDocumentationUrl } from "@/lib/ui-copy";

interface TutorialStep {
  title: string;
  summary: string;
  bullets: string[];
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Welcome to CorpSim",
    summary: "You run a company in a living market. Every choice affects your growth.",
    bullets: [
      "You produce goods, trade them, and grow your company over time.",
      "Markets move as companies buy and sell, so timing matters.",
      "Plan ahead: cash, stock, and production speed all work together."
    ]
  },
  {
    title: "How the Economy Works",
    summary: "Buy low, sell smart, and keep enough stock to avoid downtime.",
    bullets: [
      "Production turns raw materials into higher-value products.",
      "If demand is high and supply is low, prices usually rise.",
      "Keep reserve cash so you can react quickly to opportunities."
    ]
  },
  {
    title: "Core Features",
    summary: "These pages are your daily tools for running the company.",
    bullets: [
      "Production: start jobs and keep lines running.",
      "Market and Contracts: buy inputs, sell outputs, and secure deals.",
      "Finance, Research, and Logistics: track cash, unlock upgrades, and move goods."
    ]
  },
  {
    title: "Documentation",
    summary: "Use the docs anytime for walkthroughs and page-by-page help.",
    bullets: [
      "Open the docs from the top bar or sidebar while playing.",
      "Follow module guides to learn efficient production loops.",
      "Use references when you need exact steps for a feature."
    ]
  }
];

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
  const [stepIndex, setStepIndex] = useState(0);

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

  const step = useMemo(() => TUTORIAL_STEPS[stepIndex], [stepIndex]);
  const isLastStep = stepIndex >= TUTORIAL_STEPS.length - 1;

  async function handleContinue() {
    if (!isLastStep) {
      setStepIndex((current) => Math.min(current + 1, TUTORIAL_STEPS.length - 1));
      return;
    }

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

  if (isLoading) {
    return (
      <AuthPageShell title="Quick Tutorial" description="Loading your introduction...">
        <p className="text-sm text-muted-foreground">Preparing your first steps in CorpSim.</p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title="Quick Tutorial"
      description="A short walkthrough before you enter your dashboard."
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
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Step {stepIndex + 1} of {TUTORIAL_STEPS.length}
        </p>
        <div className="space-y-2 rounded-lg border border-border/70 bg-background/40 p-4">
          <h2 className="text-lg font-semibold tracking-tight">{step.title}</h2>
          <p className="text-sm text-muted-foreground">{step.summary}</p>
          <ul className="space-y-1 text-sm text-foreground/90">
            {step.bullets.map((bullet) => (
              <li key={bullet}>- {bullet}</li>
            ))}
          </ul>
          {isLastStep ? (
            <p className="pt-1 text-sm text-muted-foreground">
              Ready to play? You can open the docs now or continue to the dashboard.
            </p>
          ) : null}
        </div>

        {error ? <Alert variant="destructive">{error}</Alert> : null}

        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
            disabled={stepIndex === 0 || isSubmitting}
          >
            Back
          </Button>
          <Button type="button" onClick={() => void handleContinue()} disabled={isSubmitting}>
            {isLastStep ? (isSubmitting ? "Finishing..." : "Enter Dashboard") : "Next"}
          </Button>
        </div>
      </div>
    </AuthPageShell>
  );
}

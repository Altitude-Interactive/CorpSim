"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { completeOnboardingTutorial } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface GuidedTutorialStep {
  route: string;
  targetId: string;
  title: string;
  description: string;
}

const GUIDED_TUTORIAL_STEPS: GuidedTutorialStep[] = [
  {
    route: "/overview",
    targetId: "overview-kpis",
    title: "Start with the world pulse",
    description:
      "These metrics summarize the full simulation (all companies), not just your company."
  },
  {
    route: "/overview",
    targetId: "overview-integrity",
    title: "Watch system integrity",
    description: "If there are issues here, investigate before scaling operations."
  },
  {
    route: "/market",
    targetId: "market-order-placement",
    title: "Place buy and sell orders",
    description: "This is where you create market orders for the active company."
  },
  {
    route: "/market",
    targetId: "market-order-book",
    title: "Read the order book",
    description: "Use this table to inspect current prices, quantity, and market depth."
  },
  {
    route: "/production",
    targetId: "production-start",
    title: "Start production runs",
    description: "Pick a recipe and quantity, then launch jobs from this panel."
  },
  {
    route: "/production",
    targetId: "production-recipes",
    title: "Review recipes first",
    description: "Check output, duration, and required inputs before committing runs."
  },
  {
    route: "/inventory",
    targetId: "inventory-filters",
    title: "Filter your inventory view",
    description: "Search and region filters help you focus the exact stock you need."
  },
  {
    route: "/inventory",
    targetId: "inventory-table",
    title: "Track available stock",
    description: "Use quantity, reserved, and available values to avoid production stalls."
  }
];

const SPOTLIGHT_PADDING_PX = 8;
const CARD_ESTIMATED_HEIGHT_PX = 220;
const CARD_MAX_WIDTH_PX = 360;

function clampStepIndex(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(Math.trunc(value), 0), GUIDED_TUTORIAL_STEPS.length - 1);
}

function buildTutorialHref(route: string, stepIndex: number): string {
  const params = new URLSearchParams();
  params.set("tutorial", "1");
  params.set("tutorialStep", String(stepIndex));
  return `${route}?${params.toString()}`;
}

function readErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unable to finish tutorial right now. Please try again.";
}

export function GuidedTutorialOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isTutorialActive = searchParams.get("tutorial") === "1";
  const stepIndex = useMemo(
    () => clampStepIndex(Number.parseInt(searchParams.get("tutorialStep") ?? "0", 10)),
    [searchParams]
  );
  const step = GUIDED_TUTORIAL_STEPS[stepIndex];
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex >= GUIDED_TUTORIAL_STEPS.length - 1;

  useEffect(() => {
    if (!isTutorialActive) {
      return;
    }

    const updateViewport = () =>
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });

    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, [isTutorialActive]);

  useEffect(() => {
    if (!isTutorialActive) {
      return;
    }

    if (pathname !== step.route) {
      router.replace(buildTutorialHref(step.route, stepIndex));
    }
  }, [isTutorialActive, pathname, router, step.route, stepIndex]);

  useEffect(() => {
    if (!isTutorialActive || pathname !== step.route) {
      setTargetRect(null);
      return;
    }

    const query = `[data-tutorial-id="${step.targetId}"]`;
    const updateRect = () => {
      const element = document.querySelector<HTMLElement>(query);
      if (!element) {
        setTargetRect(null);
        return;
      }
      setTargetRect(element.getBoundingClientRect());
    };

    updateRect();
    const interval = window.setInterval(updateRect, 250);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [isTutorialActive, pathname, step.route, step.targetId]);

  const spotlightStyle = useMemo(() => {
    if (!targetRect) {
      return null;
    }

    const top = Math.max(8, targetRect.top - SPOTLIGHT_PADDING_PX);
    const left = Math.max(8, targetRect.left - SPOTLIGHT_PADDING_PX);
    const width = targetRect.width + SPOTLIGHT_PADDING_PX * 2;
    const height = targetRect.height + SPOTLIGHT_PADDING_PX * 2;

    return {
      top,
      left,
      width,
      height
    };
  }, [targetRect]);

  const cardStyle = useMemo(() => {
    if (!targetRect || viewportSize.width <= 0 || viewportSize.height <= 0) {
      return {
        right: 16,
        bottom: 16,
        width: CARD_MAX_WIDTH_PX
      };
    }

    let top = targetRect.bottom + 12;
    if (top + CARD_ESTIMATED_HEIGHT_PX > viewportSize.height - 16) {
      top = targetRect.top - CARD_ESTIMATED_HEIGHT_PX - 12;
    }
    top = Math.max(16, top);

    let left = targetRect.left;
    const width = Math.min(CARD_MAX_WIDTH_PX, Math.max(280, viewportSize.width - 32));
    if (left + width > viewportSize.width - 16) {
      left = viewportSize.width - width - 16;
    }
    left = Math.max(16, left);

    return {
      top,
      left,
      width
    };
  }, [targetRect, viewportSize.height, viewportSize.width]);

  const goToStep = useCallback(
    (nextStepIndex: number) => {
      const clampedIndex = clampStepIndex(nextStepIndex);
      const nextStep = GUIDED_TUTORIAL_STEPS[clampedIndex];
      setError(null);
      router.replace(buildTutorialHref(nextStep.route, clampedIndex));
    },
    [router]
  );

  const completeTutorial = useCallback(async () => {
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
  }, [isSubmitting, router]);

  if (!isTutorialActive) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      {spotlightStyle ? (
        <div
          className="fixed rounded-xl border border-cyan-400/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.76)]"
          style={spotlightStyle}
        />
      ) : (
        <div className="fixed inset-0 bg-slate-950/75" />
      )}

      <div
        className="pointer-events-auto fixed rounded-xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-sm"
        style={cardStyle}
      >
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Guided Tutorial {stepIndex + 1}/{GUIDED_TUTORIAL_STEPS.length}
        </p>
        <h2 className="mt-1 text-base font-semibold">{step.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>

        {targetRect ? null : (
          <p className="mt-2 text-xs text-amber-300">
            Waiting for this section to load on the page.
          </p>
        )}

        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => goToStep(stepIndex - 1)}
            disabled={isFirstStep || isSubmitting}
          >
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => void completeTutorial()} disabled={isSubmitting}>
              {isSubmitting ? "Skipping..." : "Skip"}
            </Button>
            {isLastStep ? (
              <Button type="button" size="sm" onClick={() => void completeTutorial()} disabled={isSubmitting}>
                {isSubmitting ? "Finishing..." : "Finish"}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={() => goToStep(stepIndex + 1)} disabled={isSubmitting}>
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

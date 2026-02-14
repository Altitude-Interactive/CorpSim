"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeOnboarding, getOnboardingStatus, listRegions, type RegionSummary } from "@/lib/api";
import { AuthPageShell } from "@/components/auth/auth-page-shell";

function readErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "Unable to complete setup right now. Please try again.";
}

export default function OnboardingPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([getOnboardingStatus(), listRegions()])
      .then(([status, regionRows]) => {
        if (!active) {
          return;
        }

        if (status.completed) {
          router.replace("/overview");
          return;
        }

        setRegions(regionRows);

        const defaultRegion = regionRows.find((region) => region.code === "CORE") ?? regionRows[0];
        if (defaultRegion) {
          setRegionId(defaultRegion.id);
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await completeOnboarding({
        companyName: companyName.trim(),
        regionId: regionId || undefined
      });
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
      <AuthPageShell title="Set Up Your Company" description="Loading setup options...">
        <p className="text-sm text-muted-foreground">Preparing your first company profile.</p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      title="Set Up Your Company"
      description="Choose your company name and starting region before entering the dashboard."
    >
      <form className="space-y-3" onSubmit={(event) => void handleSubmit(event)}>
        <div className="space-y-1.5">
          <label htmlFor="onboarding-company-name" className="text-sm text-muted-foreground">
            Company name
          </label>
          <Input
            id="onboarding-company-name"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Atlas Manufacturing"
            required
            minLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="onboarding-region" className="text-sm text-muted-foreground">
            Starting region
          </label>
          <select
            id="onboarding-region"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm"
            value={regionId}
            onChange={(event) => setRegionId(event.target.value)}
            disabled={regions.length === 0}
          >
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
        {error ? <Alert variant="destructive">{error}</Alert> : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Finishing setup..." : "Enter Dashboard"}
        </Button>
      </form>
    </AuthPageShell>
  );
}


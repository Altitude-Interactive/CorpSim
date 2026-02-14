"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Box } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AuthPageShellProps {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthPageShell({ title, description, children, footer }: AuthPageShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.16),transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-xl items-center px-4 py-8">
        <Card className="w-full border-border/70 bg-card/95 shadow-xl shadow-black/30">
          <CardHeader className="space-y-3 border-b border-border/60 pb-5">
            <Link href="/" className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <span className="rounded-md bg-primary/15 p-1.5 text-primary">
                <Box className="h-3.5 w-3.5" />
              </span>
              CorpSim ERP
            </Link>
            <div className="space-y-1">
              <CardTitle className="text-xl tracking-tight">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">{children}</CardContent>
          {footer ? <div className="border-t border-border/60 px-4 py-4 text-sm">{footer}</div> : null}
        </Card>
      </div>
    </main>
  );
}


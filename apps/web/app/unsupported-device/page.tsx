import { AlertTriangle, BookOpenText, MonitorSmartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocumentationUrl, UI_COPY } from "@/lib/ui-copy";

export default function UnsupportedDevicePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.14),transparent_55%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1200px] items-center justify-center p-6 lg:p-10">
        <Card className="w-full max-w-3xl border-border/70 bg-card/95 shadow-2xl shadow-black/35">
          <CardHeader className="border-b border-border/60 pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-destructive/15 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <CardTitle className="text-xl tracking-tight">
                  Desktop or tablet required
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  CorpSim ERP is built for larger screens and is not available on mobile phones.
                </p>
              </div>
              <Badge variant="warning">Unsupported Device</Badge>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6 pt-6 md:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Continue on a tablet or computer to access the full game interface.
              </p>
              <Button asChild variant="outline">
                <a href={getDocumentationUrl("/overview")} target="_blank" rel="noreferrer">
                  <BookOpenText className="mr-2 h-4 w-4" />
                  {UI_COPY.documentation.openCta}
                </a>
              </Button>
            </section>

            <section className="rounded-md border border-border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Supported access
              </p>
              <div className="mt-3 flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  <MonitorSmartphone className="h-4 w-4" />
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-medium text-foreground">Tablet and desktop devices</p>
                  <p className="text-muted-foreground">Phone screens are not supported.</p>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

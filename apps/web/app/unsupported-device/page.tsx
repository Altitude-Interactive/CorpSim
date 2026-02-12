import { AlertTriangle, MonitorSmartphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDocumentationUrl, UI_COPY } from "@/lib/ui-copy";

const MIN_SUPPORTED_WIDTH_PX = 900;

export default function UnsupportedDevicePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-xl border-destructive/40 bg-card/95">
        <CardHeader className="space-y-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl">Mobile is not supported for CorpSim ERP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            This ERP interface is optimized for data-dense operations and requires at least tablet
            width to render correctly.
          </p>
          <p>
            Please continue on a tablet or desktop device (minimum viewport width:{" "}
            <span className="font-medium text-foreground">{MIN_SUPPORTED_WIDTH_PX}px</span>).
          </p>
          <div className="rounded-md border border-border bg-muted/20 p-3 text-xs">
            <p className="inline-flex items-center gap-2 text-foreground">
              <MonitorSmartphone className="h-4 w-4" />
              Supported form factors: tablet and desktop browsers
            </p>
          </div>
          <a
            href={getDocumentationUrl("/overview")}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {UI_COPY.documentation.openCta}
          </a>
        </CardContent>
      </Card>
    </main>
  );
}


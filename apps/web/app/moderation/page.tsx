import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Moderation | CorpSim ERP"
};

export default function ModerationRoute() {
  return (
    <div className="flex w-full flex-col gap-6 p-6">
      <Card className="border-sky-500/40 bg-sky-950/50">
        <CardHeader>
          <CardTitle className="text-sky-100">Moderation</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-sky-200">
          Moderation tools will appear here soon.
        </CardContent>
      </Card>
    </div>
  );
}

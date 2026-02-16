import type { Metadata } from "next";
import { ModerationPage } from "@/components/moderation/moderation-page";

export const metadata: Metadata = {
  title: "Moderation | CorpSim ERP"
};

export default function ModerationRoute() {
  return <ModerationPage />;
}

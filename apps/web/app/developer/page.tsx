import type { Metadata } from "next";
import { DevCatalogPage } from "@/components/dev/dev-catalog-page";

export const metadata: Metadata = {
  title: "Developer | CorpSim ERP"
};

export const dynamic = "force-dynamic";

export default function DeveloperRoute() {
  return <DevCatalogPage />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DevCatalogPage } from "@/components/dev/dev-catalog-page";

export const metadata: Metadata = {
  title: "Dev Catalog | CorpSim ERP",
  robots: {
    index: false,
    follow: false
  }
};

export const dynamic = "force-dynamic";

export default function DevCatalogRoute() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <DevCatalogPage />;
}

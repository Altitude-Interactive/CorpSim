import type { Metadata } from "next";
import { PlayerRegistryCatalogPage } from "@/components/players/player-registry-catalog-page";

export const metadata: Metadata = {
  title: "Player Registry | CorpSim ERP",
  robots: {
    index: false,
    follow: false
  }
};

export const dynamic = "force-dynamic";

export default function PlayerRegistryCatalogRoute() {
  return <PlayerRegistryCatalogPage />;
}

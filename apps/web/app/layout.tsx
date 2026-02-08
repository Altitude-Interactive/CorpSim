import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { WorldHealthProvider } from "@/components/layout/world-health-provider";
import { ActiveCompanyProvider } from "@/components/company/active-company-provider";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "CorpSim ERP",
  description: "Dark ERP dashboard for CorpSim simulation control and monitoring."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ToastProvider>
          <WorldHealthProvider>
            <ActiveCompanyProvider>
              <AppShell>{children}</AppShell>
            </ActiveCompanyProvider>
          </WorldHealthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

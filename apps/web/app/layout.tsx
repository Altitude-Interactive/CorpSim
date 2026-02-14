import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthRouteGate } from "@/components/auth/auth-route-gate";
import { AppShell } from "@/components/layout/app-shell";
import { DeviceSupportGate } from "@/components/layout/device-support-gate";
import { UiSfxProvider } from "@/components/layout/ui-sfx-provider";
import { MaintenanceProvider } from "@/components/maintenance/maintenance-provider";
import { WorldHealthProvider } from "@/components/layout/world-health-provider";
import { ActiveCompanyProvider } from "@/components/company/active-company-provider";
import { ToastProvider } from "@/components/ui/toast-manager";

const inter = Inter({
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "CorpSim ERP",
  description: "A persistent corporate management simulation inspired by ERP systems. Run production chains, trade on regional markets, manage logistics, research technologies, and control your company inside a deterministic economic world.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <UiSfxProvider>
          <ToastProvider>
            <MaintenanceProvider>
              <AuthRouteGate>
                <WorldHealthProvider>
                  <ActiveCompanyProvider>
                    <DeviceSupportGate>
                      <AppShell>{children}</AppShell>
                    </DeviceSupportGate>
                  </ActiveCompanyProvider>
                </WorldHealthProvider>
              </AuthRouteGate>
            </MaintenanceProvider>
          </ToastProvider>
        </UiSfxProvider>
      </body>
    </html>
  );
}


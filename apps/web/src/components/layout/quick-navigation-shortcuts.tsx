"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ControlShortcut } from "./control-manager";
import { useControlManager } from "./control-manager";
import { PROFILE_PANEL_ID } from "./profile-panel";

export function QuickNavigationShortcuts() {
  const router = useRouter();
  const { registerShortcut, closePanel, openPanel } = useControlManager();

  const shortcuts = useMemo<ControlShortcut[]>(
    () => [
      {
        id: "quick-nav-market",
        key: "m",
        modifier: "ctrlOrMeta",
        shift: true,
        preventDefault: true,
        title: "Go to market",
        description: "Open market page",
        onTrigger: () => {
          closePanel();
          router.push("/market");
        }
      },
      {
        id: "quick-nav-production",
        key: "p",
        modifier: "ctrlOrMeta",
        shift: true,
        preventDefault: true,
        title: "Go to production",
        description: "Open production page",
        onTrigger: () => {
          closePanel();
          router.push("/production");
        }
      },
      {
        id: "quick-nav-inventory",
        key: "v",
        modifier: "ctrlOrMeta",
        shift: true,
        preventDefault: true,
        title: "Go to inventory",
        description: "Open inventory page",
        onTrigger: () => {
          closePanel();
          router.push("/inventory");
        }
      },
      {
        id: "quick-nav-finance",
        key: "f",
        modifier: "ctrlOrMeta",
        shift: true,
        preventDefault: true,
        title: "Go to finance",
        description: "Open finance page",
        onTrigger: () => {
          closePanel();
          router.push("/finance");
        }
      },
      {
        id: "quick-nav-logistics",
        key: "l",
        modifier: "ctrlOrMeta",
        shift: true,
        preventDefault: true,
        title: "Go to logistics",
        description: "Open logistics page",
        onTrigger: () => {
          closePanel();
          router.push("/logistics");
        }
      },
      {
        id: "quick-nav-analytics",
        key: "a",
        modifier: "ctrlOrMeta",
        shift: true,
        preventDefault: true,
        title: "Go to analytics",
        description: "Open analytics page",
        onTrigger: () => {
          closePanel();
          router.push("/analytics");
        }
      },
      {
        id: "quick-open-profile",
        key: "u",
        modifier: "ctrlOrMeta",
        shift: true,
        preventDefault: true,
        title: "Open profile",
        description: "Show account profile popup",
        onTrigger: () => {
          openPanel(PROFILE_PANEL_ID);
        }
      }
    ],
    [closePanel, openPanel, router]
  );

  useEffect(() => {
    const unregister = shortcuts.map((shortcut) => registerShortcut(shortcut));
    return () => {
      unregister.forEach((cleanup) => cleanup());
    };
  }, [registerShortcut, shortcuts]);

  return null;
}

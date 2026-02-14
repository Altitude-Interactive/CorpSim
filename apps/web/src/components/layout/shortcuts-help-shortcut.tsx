"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ToastOverlay } from "@/components/ui/toast-manager";
import { useControlManager, useControlShortcut, type RegisteredControlShortcut } from "./control-manager";

const SHORTCUTS_HELP_PANEL_ID = "shortcuts-help";

function formatShortcut(shortcut: RegisteredControlShortcut): string {
  const isMacLike = /mac|iphone|ipad|ipod/i.test(globalThis.navigator?.platform ?? "");
  const parts: string[] = [];

  if (shortcut.modifier === "ctrlOrMeta") {
    parts.push(isMacLike ? "Cmd" : "Ctrl");
  } else if (shortcut.modifier === "ctrl") {
    parts.push("Ctrl");
  } else if (shortcut.modifier === "meta") {
    parts.push(isMacLike ? "Cmd" : "Meta");
  }

  if (shortcut.shift) {
    parts.push("Shift");
  }
  if (shortcut.alt) {
    parts.push(isMacLike ? "Option" : "Alt");
  }

  const key = shortcut.key === "/" ? "/" : shortcut.key.toUpperCase();
  parts.push(key);
  return parts.join(" + ");
}

export function ShortcutsHelpShortcut() {
  const { registeredShortcuts, isPanelOpen, togglePanel, closePanel } = useControlManager();
  const open = isPanelOpen(SHORTCUTS_HELP_PANEL_ID);

  const shortcut = useMemo(
    () => ({
      id: "shortcuts-help-open",
      key: "/",
      code: "Slash",
      modifier: "ctrlOrMeta" as const,
      allowShiftMismatch: true,
      allowWhenTyping: true,
      preventDefault: true,
      title: "Shortcut help",
      description: "Show available keyboard shortcuts",
      onTrigger: () => {
        togglePanel(SHORTCUTS_HELP_PANEL_ID);
      }
    }),
    [togglePanel]
  );

  useControlShortcut(shortcut);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closePanel(SHORTCUTS_HELP_PANEL_ID);
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [closePanel, open]);

  const displayShortcuts = useMemo(
    () =>
      registeredShortcuts
        .slice()
        .sort((left, right) => left.title.localeCompare(right.title))
        .map((entry) => ({
          id: entry.id,
          combo: formatShortcut(entry),
          title: entry.title,
          description: entry.description
        })),
    [registeredShortcuts]
  );

  if (!open) {
    return null;
  }

  return (
    <ToastOverlay
      backdrop="solid"
      variant="default"
      layerClassName="z-[9700] p-4 sm:p-8"
      panelClassName="max-w-xl p-0"
      onBackdropMouseDown={() => closePanel(SHORTCUTS_HELP_PANEL_ID)}
      labelledBy="shortcuts-help-title"
      describedBy="shortcuts-help-description"
    >
      <header className="border-b border-border px-4 py-4">
        <h2 id="shortcuts-help-title" className="text-lg font-semibold text-slate-100">
          Keyboard shortcuts
        </h2>
        <p id="shortcuts-help-description" className="mt-1 text-sm text-slate-300">
          Use these shortcuts to navigate and open quick views.
        </p>
      </header>

      <div className="max-h-[50vh] overflow-auto px-4 py-4">
        <ul className="space-y-2">
          {displayShortcuts.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-100">{entry.title}</p>
                {entry.description ? (
                  <p className="text-xs text-slate-300">{entry.description}</p>
                ) : null}
              </div>
              <kbd className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-100">{entry.combo}</kbd>
            </li>
          ))}
        </ul>
      </div>

      <footer className="flex justify-end border-t border-border px-4 py-3">
        <Button type="button" variant="outline" size="sm" onClick={() => closePanel(SHORTCUTS_HELP_PANEL_ID)}>
          Close
        </Button>
      </footer>
    </ToastOverlay>
  );
}

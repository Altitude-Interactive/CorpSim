"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToastOverlay } from "@/components/ui/toast-manager";
import {
  type ControlShortcutBinding,
  useControlManager,
  useControlShortcut
} from "./control-manager";

const SHORTCUTS_HELP_PANEL_ID = "shortcuts-help";

function formatShortcut(binding: ControlShortcutBinding): string {
  const isMacLike = /mac|iphone|ipad|ipod/i.test(globalThis.navigator?.platform ?? "");
  const parts: string[] = [];

  if (binding.modifier === "ctrlOrMeta") {
    parts.push(isMacLike ? "Cmd" : "Ctrl");
  } else if (binding.modifier === "ctrl") {
    parts.push("Ctrl");
  } else if (binding.modifier === "meta") {
    parts.push(isMacLike ? "Cmd" : "Meta");
  }

  if (binding.shift) {
    parts.push("Shift");
  }
  if (binding.alt) {
    parts.push(isMacLike ? "Option" : "Alt");
  }

  const key = binding.key.length === 1 ? binding.key : binding.key.toUpperCase();
  parts.push(key);
  return parts.join(" + ");
}

function normalizeCapturedKey(rawKey: string): string | null {
  const next = rawKey.trim().toLowerCase();
  if (!next) {
    return null;
  }
  if (next === "control" || next === "shift" || next === "meta" || next === "alt") {
    return null;
  }
  if (next === " ") {
    return "space";
  }
  return next;
}

function captureBindingFromKeyboardEvent(event: KeyboardEvent): ControlShortcutBinding | null {
  const key = normalizeCapturedKey(event.key);
  if (!key || key === "escape") {
    return null;
  }

  return {
    key,
    modifier: event.ctrlKey || event.metaKey ? "ctrlOrMeta" : "none",
    shift: event.shiftKey,
    alt: event.altKey
  };
}

export function ShortcutsHelpShortcut() {
  const {
    registeredShortcuts,
    setShortcutBinding,
    resetShortcutBinding,
    setShortcutCaptureActive,
    isPanelOpen,
    togglePanel,
    closePanel
  } = useControlManager();
  const open = isPanelOpen(SHORTCUTS_HELP_PANEL_ID);
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);

  const toggleShortcutsHelp = useCallback(() => {
    togglePanel(SHORTCUTS_HELP_PANEL_ID);
  }, [togglePanel]);

  const shortcut = useMemo(
    () => ({
      id: "shortcuts-help-open",
      key: "/",
      code: ["Semicolon", "NumpadDivide"],
      modifier: "ctrlOrMeta" as const,
      allowShiftMismatch: true,
      allowWhenTyping: true,
      preventDefault: true,
      title: "Shortcut help",
      description: "Show available keyboard shortcuts",
      onTrigger: toggleShortcutsHelp
    }),
    [toggleShortcutsHelp]
  );

  useControlShortcut(shortcut);

  useEffect(() => {
    if (!open) {
      setEditingShortcutId(null);
    }
  }, [open]);

  useEffect(() => {
    setShortcutCaptureActive(Boolean(editingShortcutId));
    return () => {
      setShortcutCaptureActive(false);
    };
  }, [editingShortcutId, setShortcutCaptureActive]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (editingShortcutId) {
        if (event.key === "Escape") {
          event.preventDefault();
          setEditingShortcutId(null);
          return;
        }

        const binding = captureBindingFromKeyboardEvent(event);
        if (!binding) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        setShortcutBinding(editingShortcutId, binding);
        setEditingShortcutId(null);
        return;
      }

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
  }, [closePanel, editingShortcutId, open, setShortcutBinding]);

  const displayShortcuts = useMemo(
    () =>
      registeredShortcuts
        .slice()
        .sort((left, right) => left.title.localeCompare(right.title))
        .map((entry) => ({
          id: entry.id,
          combo: formatShortcut(entry),
          title: entry.title,
          description: entry.description,
          isCustom: entry.isCustom,
          defaultCombo: formatShortcut(entry.defaultBinding)
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
      panelClassName="max-w-2xl p-0"
      onBackdropMouseDown={() => closePanel(SHORTCUTS_HELP_PANEL_ID)}
      labelledBy="shortcuts-help-title"
      describedBy="shortcuts-help-description"
    >
      <header className="border-b border-border px-4 py-4">
        <h2 id="shortcuts-help-title" className="text-lg font-semibold text-slate-100">
          Keyboard shortcuts
        </h2>
        <p id="shortcuts-help-description" className="mt-1 text-sm text-slate-300">
          Press Edit to change a shortcut. Your choices are saved on this browser.
        </p>
      </header>

      <div className="max-h-[54vh] overflow-auto px-4 py-4">
        <ul className="space-y-2">
          {displayShortcuts.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2"
            >
              <div className="min-w-[180px] flex-1">
                <p className="text-sm font-medium text-slate-100">{entry.title}</p>
                {entry.description ? <p className="text-xs text-slate-300">{entry.description}</p> : null}
                {entry.isCustom ? (
                  <p className="text-xs text-slate-400">Default: {entry.defaultCombo}</p>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <kbd className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-100">{entry.combo}</kbd>

                {editingShortcutId === entry.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-300">Press new keys...</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingShortcutId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingShortcutId(entry.id)}
                    >
                      Edit
                    </Button>
                    {entry.isCustom ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => resetShortcutBinding(entry.id)}
                      >
                        Reset
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
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

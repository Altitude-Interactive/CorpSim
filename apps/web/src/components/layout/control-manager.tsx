"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef
} from "react";

export type ControlShortcutModifier = "ctrlOrMeta" | "ctrl" | "meta" | "none";

export interface ControlShortcut {
  id: string;
  key: string;
  modifier?: ControlShortcutModifier;
  shift?: boolean;
  alt?: boolean;
  allowWhenTyping?: boolean;
  preventDefault?: boolean;
  onTrigger: () => void;
}

interface ControlManagerContextValue {
  registerShortcut: (shortcut: ControlShortcut) => () => void;
}

const ControlManagerContext = createContext<ControlManagerContextValue | null>(null);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
}

function hasModifierMatch(event: KeyboardEvent, modifier: ControlShortcutModifier): boolean {
  if (modifier === "none") {
    return !event.ctrlKey && !event.metaKey;
  }
  if (modifier === "ctrl") {
    return event.ctrlKey && !event.metaKey;
  }
  if (modifier === "meta") {
    return event.metaKey && !event.ctrlKey;
  }
  return event.ctrlKey || event.metaKey;
}

function matchesShortcut(event: KeyboardEvent, shortcut: ControlShortcut): boolean {
  const modifier = shortcut.modifier ?? "ctrlOrMeta";
  const expectedKey = normalizeKey(shortcut.key);
  const eventKey = normalizeKey(event.key);

  if (eventKey !== expectedKey) {
    return false;
  }
  if (!hasModifierMatch(event, modifier)) {
    return false;
  }
  if ((shortcut.shift ?? false) !== event.shiftKey) {
    return false;
  }
  if ((shortcut.alt ?? false) !== event.altKey) {
    return false;
  }

  return true;
}

export function ControlManagerProvider({ children }: { children: React.ReactNode }) {
  const shortcutsRef = useRef<Map<string, ControlShortcut>>(new Map());

  const registerShortcut = useCallback((shortcut: ControlShortcut) => {
    shortcutsRef.current.set(shortcut.id, shortcut);

    return () => {
      shortcutsRef.current.delete(shortcut.id);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }

      for (const shortcut of shortcutsRef.current.values()) {
        if (!shortcut.allowWhenTyping && isTypingTarget(event.target)) {
          continue;
        }
        if (!matchesShortcut(event, shortcut)) {
          continue;
        }

        if (shortcut.preventDefault !== false) {
          event.preventDefault();
        }
        shortcut.onTrigger();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  const value = useMemo<ControlManagerContextValue>(
    () => ({
      registerShortcut
    }),
    [registerShortcut]
  );

  return (
    <ControlManagerContext.Provider value={value}>{children}</ControlManagerContext.Provider>
  );
}

export function useControlManager() {
  const context = useContext(ControlManagerContext);
  if (!context) {
    throw new Error("useControlManager must be used inside ControlManagerProvider");
  }
  return context;
}

export function useControlShortcut(shortcut: ControlShortcut) {
  const { registerShortcut } = useControlManager();

  useEffect(() => registerShortcut(shortcut), [registerShortcut, shortcut]);
}

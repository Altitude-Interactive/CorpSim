"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

export type ControlShortcutModifier = "ctrlOrMeta" | "ctrl" | "meta" | "none";

export interface ControlShortcutBinding {
  key: string;
  modifier: ControlShortcutModifier;
  shift: boolean;
  alt: boolean;
}

export interface ControlShortcut {
  id: string;
  key: string;
  code?: string | string[];
  modifier?: ControlShortcutModifier;
  shift?: boolean;
  allowShiftMismatch?: boolean;
  alt?: boolean;
  allowWhenTyping?: boolean;
  preventDefault?: boolean;
  title?: string;
  description?: string;
  onTrigger: () => void;
}

export interface RegisteredControlShortcut extends ControlShortcutBinding {
  id: string;
  title: string;
  description?: string;
  defaultBinding: ControlShortcutBinding;
  isCustom: boolean;
}

interface RegisteredControlShortcutDefinition {
  id: string;
  title: string;
  description?: string;
  defaultBinding: ControlShortcutBinding;
}

interface PersistedControlShortcutsV1 {
  version: 1;
  updatedAt: string;
  bindings: Record<string, ControlShortcutBinding>;
}

interface ControlManagerContextValue {
  registerShortcut: (shortcut: ControlShortcut) => () => void;
  registeredShortcuts: RegisteredControlShortcut[];
  setShortcutBinding: (shortcutId: string, binding: ControlShortcutBinding) => void;
  resetShortcutBinding: (shortcutId: string) => void;
  setShortcutCaptureActive: (active: boolean) => void;
  isPanelOpen: (panelId: string) => boolean;
  openPanel: (panelId: string) => void;
  closePanel: (panelId?: string) => void;
  togglePanel: (panelId: string) => void;
}

const ControlManagerContext = createContext<ControlManagerContextValue | null>(null);

const SHORTCUT_BINDINGS_STORAGE_KEY = "corpsim.control.shortcuts.v1";

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

function isControlShortcutModifier(value: unknown): value is ControlShortcutModifier {
  return value === "ctrlOrMeta" || value === "ctrl" || value === "meta" || value === "none";
}

function isControlShortcutBinding(value: unknown): value is ControlShortcutBinding {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<ControlShortcutBinding>;
  return (
    typeof candidate.key === "string" &&
    candidate.key.trim().length > 0 &&
    isControlShortcutModifier(candidate.modifier) &&
    typeof candidate.shift === "boolean" &&
    typeof candidate.alt === "boolean"
  );
}

function readPersistedBindings(): Record<string, ControlShortcutBinding> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(SHORTCUT_BINDINGS_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Partial<PersistedControlShortcutsV1>;
    if (parsed.version !== 1 || !parsed.bindings || typeof parsed.bindings !== "object") {
      return {};
    }

    const next: Record<string, ControlShortcutBinding> = {};
    for (const [id, binding] of Object.entries(parsed.bindings)) {
      if (typeof id !== "string" || !isControlShortcutBinding(binding)) {
        continue;
      }
      next[id] = binding;
    }
    return next;
  } catch {
    return {};
  }
}

function persistBindings(bindings: Record<string, ControlShortcutBinding>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload: PersistedControlShortcutsV1 = {
      version: 1,
      updatedAt: new Date().toISOString(),
      bindings
    };
    window.localStorage.setItem(SHORTCUT_BINDINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore persistence failures.
  }
}

function matchesShortcut(event: KeyboardEvent, shortcut: ControlShortcut): boolean {
  const modifier = shortcut.modifier ?? "ctrlOrMeta";
  const expectedKey = normalizeKey(shortcut.key);
  const eventKey = normalizeKey(event.key);
  const expectedCodes = Array.isArray(shortcut.code)
    ? shortcut.code.map(normalizeKey)
    : shortcut.code
      ? [normalizeKey(shortcut.code)]
      : [];
  const eventCode = normalizeKey(event.code);
  const codeMatches = expectedCodes.length > 0 && expectedCodes.includes(eventCode);

  if (eventKey !== expectedKey && !codeMatches) {
    return false;
  }
  if (!hasModifierMatch(event, modifier)) {
    return false;
  }
  if (!shortcut.allowShiftMismatch && (shortcut.shift ?? false) !== event.shiftKey) {
    return false;
  }
  if ((shortcut.alt ?? false) !== event.altKey) {
    return false;
  }

  return true;
}

function defaultBindingFromShortcut(shortcut: ControlShortcut): ControlShortcutBinding {
  return {
    key: shortcut.key,
    modifier: shortcut.modifier ?? "ctrlOrMeta",
    shift: shortcut.shift ?? false,
    alt: shortcut.alt ?? false
  };
}

function applyBindingToShortcut(
  shortcut: ControlShortcut,
  binding: ControlShortcutBinding | undefined
): ControlShortcut {
  if (!binding) {
    return shortcut;
  }
  return {
    ...shortcut,
    key: binding.key,
    modifier: binding.modifier,
    shift: binding.shift,
    alt: binding.alt,
    code: undefined,
    allowShiftMismatch: false
  };
}

export function ControlManagerProvider({ children }: { children: React.ReactNode }) {
  const shortcutsRef = useRef<Map<string, ControlShortcut>>(new Map());
  const registeredShortcutsRef = useRef<Map<string, RegisteredControlShortcutDefinition>>(new Map());
  const [registeredShortcuts, setRegisteredShortcuts] = useState<RegisteredControlShortcut[]>([]);
  const [activePanelId, setActivePanelId] = useState<string | null>(null);
  const [shortcutBindings, setShortcutBindings] = useState<Record<string, ControlShortcutBinding>>(
    () => readPersistedBindings()
  );
  const [isShortcutCaptureActive, setShortcutCaptureActive] = useState(false);
  const shortcutBindingsRef = useRef<Record<string, ControlShortcutBinding>>(shortcutBindings);
  const isShortcutCaptureActiveRef = useRef<boolean>(isShortcutCaptureActive);

  const syncRegisteredShortcuts = useCallback(() => {
    const overrides = shortcutBindingsRef.current;
    const next = Array.from(registeredShortcutsRef.current.values()).map((entry) => {
      const override = overrides[entry.id];
      const activeBinding = override ?? entry.defaultBinding;
      return {
        id: entry.id,
        key: activeBinding.key,
        modifier: activeBinding.modifier,
        shift: activeBinding.shift,
        alt: activeBinding.alt,
        title: entry.title,
        description: entry.description,
        defaultBinding: entry.defaultBinding,
        isCustom: Boolean(override)
      };
    });
    setRegisteredShortcuts(next);
  }, []);

  useEffect(() => {
    shortcutBindingsRef.current = shortcutBindings;
    persistBindings(shortcutBindings);
    syncRegisteredShortcuts();
  }, [shortcutBindings, syncRegisteredShortcuts]);

  useEffect(() => {
    isShortcutCaptureActiveRef.current = isShortcutCaptureActive;
  }, [isShortcutCaptureActive]);

  const registerShortcut = useCallback((shortcut: ControlShortcut) => {
    shortcutsRef.current.set(shortcut.id, shortcut);
    if (shortcut.title) {
      registeredShortcutsRef.current.set(shortcut.id, {
        id: shortcut.id,
        title: shortcut.title,
        description: shortcut.description,
        defaultBinding: defaultBindingFromShortcut(shortcut)
      });
      syncRegisteredShortcuts();
    }

    return () => {
      shortcutsRef.current.delete(shortcut.id);
      if (registeredShortcutsRef.current.delete(shortcut.id)) {
        syncRegisteredShortcuts();
      }
    };
  }, [syncRegisteredShortcuts]);

  const setShortcutBinding = useCallback((shortcutId: string, binding: ControlShortcutBinding) => {
    setShortcutBindings((current) => ({
      ...current,
      [shortcutId]: binding
    }));
  }, []);

  const resetShortcutBinding = useCallback((shortcutId: string) => {
    setShortcutBindings((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, shortcutId)) {
        return current;
      }
      const next = { ...current };
      delete next[shortcutId];
      return next;
    });
  }, []);

  const isPanelOpen = useCallback(
    (panelId: string) => activePanelId === panelId,
    [activePanelId]
  );

  const openPanel = useCallback((panelId: string) => {
    setActivePanelId(panelId);
  }, []);

  const closePanel = useCallback((panelId?: string) => {
    setActivePanelId((current) => {
      if (!panelId) {
        return null;
      }
      return current === panelId ? null : current;
    });
  }, []);

  const togglePanel = useCallback((panelId: string) => {
    setActivePanelId((current) => (current === panelId ? null : panelId));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        return;
      }
      if (isShortcutCaptureActiveRef.current) {
        return;
      }

      for (const shortcut of shortcutsRef.current.values()) {
        if (!shortcut.allowWhenTyping && isTypingTarget(event.target)) {
          continue;
        }

        const effectiveShortcut = applyBindingToShortcut(
          shortcut,
          shortcutBindingsRef.current[shortcut.id]
        );

        if (!matchesShortcut(event, effectiveShortcut)) {
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
      registerShortcut,
      registeredShortcuts,
      setShortcutBinding,
      resetShortcutBinding,
      setShortcutCaptureActive,
      isPanelOpen,
      openPanel,
      closePanel,
      togglePanel
    }),
    [
      closePanel,
      isPanelOpen,
      openPanel,
      registerShortcut,
      registeredShortcuts,
      resetShortcutBinding,
      setShortcutBinding,
      setShortcutCaptureActive,
      togglePanel
    ]
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

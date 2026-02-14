"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { UiSfxPlayOptions, UiSfxSnapshot, UiSoundId, getUiSfxManager } from "@/lib/ui-sfx";

interface UiSfxContextValue {
  snapshot: UiSfxSnapshot;
  play: (id: UiSoundId, options?: UiSfxPlayOptions) => void;
  unlock: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
}

const UiSfxContext = createContext<UiSfxContextValue | null>(null);

export function UiSfxProvider({ children }: { children: React.ReactNode }) {
  const manager = getUiSfxManager();
  const [snapshot, setSnapshot] = useState<UiSfxSnapshot>(manager.getSnapshot());

  useEffect(() => {
    manager.init();
    setSnapshot(manager.getSnapshot());

    return manager.subscribe(() => {
      setSnapshot(manager.getSnapshot());
    });
  }, [manager]);

  const play = useCallback((id: UiSoundId, options?: UiSfxPlayOptions) => {
    manager.play(id, options);
  }, [manager]);

  const unlock = useCallback(async () => {
    return manager.unlock();
  }, [manager]);

  const setEnabled = useCallback((enabled: boolean) => {
    manager.setEnabled(enabled);
  }, [manager]);

  const setVolume = useCallback((volume: number) => {
    manager.setVolume(volume);
  }, [manager]);

  const value = useMemo<UiSfxContextValue>(() => ({
    snapshot,
    play,
    unlock,
    setEnabled,
    setVolume
  }), [play, setEnabled, setVolume, snapshot, unlock]);

  return <UiSfxContext.Provider value={value}>{children}</UiSfxContext.Provider>;
}

export function useUiSfx() {
  const context = useContext(UiSfxContext);
  if (!context) {
    throw new Error("useUiSfx must be used inside UiSfxProvider");
  }
  return context;
}

"use client";

export type UiSfxCategory = "ui" | "feedback" | "action" | "event";

export type UiSoundId =
  | "ui_open"
  | "ui_close"
  | "feedback_success"
  | "feedback_error"
  | "feedback_warning"
  | "feedback_neutral"
  | "action_place_order"
  | "action_cancel_order"
  | "action_start_production"
  | "action_start_research"
  | "action_contract_accept"
  | "action_contract_fulfill"
  | "event_production_completed"
  | "event_research_completed"
  | "event_shipment_arrived"
  | "event_contract_update";

export interface UiSfxSettings {
  enabled: boolean;
  volume: number;
}

export interface UiSfxSnapshot extends UiSfxSettings {
  isUnlocked: boolean;
  isSupported: boolean;
}

export interface UiSfxPlayOptions {
  volumeMultiplier?: number;
  throttleMs?: number;
}

interface UiSoundDefinition {
  src: string;
  category: UiSfxCategory;
  baseVolume: number;
}

const SETTINGS_KEY = "corpsim.ui-sfx.settings.v1";
const DEFAULT_SETTINGS: UiSfxSettings = {
  enabled: true,
  volume: 0.42
};
const GLOBAL_THROTTLE_MS = 90;
const CATEGORY_THROTTLE_MS: Record<UiSfxCategory, number> = {
  ui: 120,
  feedback: 140,
  action: 180,
  event: 500
};

const SOUND_DEFINITIONS: Record<UiSoundId, UiSoundDefinition> = {
  ui_open: {
    src: "/assets/audio/snd01-sine/transition_up.wav",
    category: "ui",
    baseVolume: 0.55
  },
  ui_close: {
    src: "/assets/audio/snd01-sine/transition_down.wav",
    category: "ui",
    baseVolume: 0.55
  },
  feedback_success: {
    src: "/assets/audio/snd01-sine/toggle_on.wav",
    category: "feedback",
    baseVolume: 0.6
  },
  feedback_error: {
    src: "/assets/audio/snd01-sine/disabled.wav",
    category: "feedback",
    baseVolume: 0.75
  },
  feedback_warning: {
    src: "/assets/audio/snd01-sine/caution.wav",
    category: "feedback",
    baseVolume: 0.65
  },
  feedback_neutral: {
    src: "/assets/audio/snd01-sine/notification.wav",
    category: "feedback",
    baseVolume: 0.45
  },
  action_place_order: {
    src: "/assets/audio/snd01-sine/button.wav",
    category: "action",
    baseVolume: 0.62
  },
  action_cancel_order: {
    src: "/assets/audio/snd01-sine/toggle_off.wav",
    category: "action",
    baseVolume: 0.58
  },
  action_start_production: {
    src: "/assets/audio/snd01-sine/select.wav",
    category: "action",
    baseVolume: 0.6
  },
  action_start_research: {
    src: "/assets/audio/snd01-sine/select.wav",
    category: "action",
    baseVolume: 0.62
  },
  action_contract_accept: {
    src: "/assets/audio/snd01-sine/button.wav",
    category: "action",
    baseVolume: 0.6
  },
  action_contract_fulfill: {
    src: "/assets/audio/snd01-sine/toggle_on.wav",
    category: "action",
    baseVolume: 0.62
  },
  event_production_completed: {
    src: "/assets/audio/snd01-sine/notification.wav",
    category: "event",
    baseVolume: 0.45
  },
  event_research_completed: {
    src: "/assets/audio/snd01-sine/transition_up.wav",
    category: "event",
    baseVolume: 0.5
  },
  event_shipment_arrived: {
    src: "/assets/audio/snd01-sine/swipe_02.wav",
    category: "event",
    baseVolume: 0.5
  },
  event_contract_update: {
    src: "/assets/audio/snd01-sine/notification.wav",
    category: "event",
    baseVolume: 0.45
  }
};

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SETTINGS.volume;
  }
  return Math.min(1, Math.max(0, value));
}

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export class UiSfxManager {
  private settings: UiSfxSettings = DEFAULT_SETTINGS;
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buffers = new Map<UiSoundId, AudioBuffer>();
  private loadingBuffers = new Map<UiSoundId, Promise<AudioBuffer | null>>();
  private listeners = new Set<() => void>();
  private initialized = false;
  private isUnlocked = false;
  private unlockListenersAttached = false;
  private unlockHandler: (() => void) | null = null;
  private supportsAudio = false;
  private lastGlobalPlayAt = 0;
  private lastCategoryPlayAt = new Map<UiSfxCategory, number>();
  private lastSoundPlayAt = new Map<UiSoundId, number>();

  init(): void {
    if (!isBrowser() || this.initialized) {
      return;
    }

    this.initialized = true;
    this.supportsAudio = Boolean(
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    );

    this.settings = this.readPersistedSettings();
    this.attachUnlockListeners();
    this.attachLifecycleListeners();
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): UiSfxSnapshot {
    return {
      ...this.settings,
      isUnlocked: this.isUnlocked,
      isSupported: this.supportsAudio
    };
  }

  getSettings(): UiSfxSettings {
    return this.settings;
  }

  setEnabled(enabled: boolean): void {
    this.settings = {
      ...this.settings,
      enabled
    };
    this.persistSettings();
    this.emit();
  }

  setVolume(volume: number): void {
    const nextVolume = clampVolume(volume);
    this.settings = {
      ...this.settings,
      volume: nextVolume
    };
    if (this.masterGain) {
      this.masterGain.gain.value = nextVolume;
    }
    this.persistSettings();
    this.emit();
  }

  async unlock(): Promise<boolean> {
    if (!isBrowser() || !this.supportsAudio) {
      return false;
    }

    const context = this.getOrCreateContext();
    if (!context) {
      return false;
    }

    if (context.state !== "running") {
      try {
        await context.resume();
      } catch {
        return false;
      }
    }

    this.isUnlocked = context.state === "running";
    if (this.isUnlocked) {
      this.detachUnlockListeners();
    }
    this.emit();
    return this.isUnlocked;
  }

  play(id: UiSoundId, options?: UiSfxPlayOptions): void {
    if (!this.settings.enabled) {
      return;
    }
    void this.playInternal(id, options);
  }

  private async playInternal(id: UiSoundId, options?: UiSfxPlayOptions): Promise<void> {
    if (!this.settings.enabled || !isBrowser() || !this.supportsAudio) {
      return;
    }

    if (!this.isUnlocked) {
      const unlocked = await this.unlock();
      if (!unlocked) {
        return;
      }
    }

    const definition = SOUND_DEFINITIONS[id];
    const context = this.getOrCreateContext();
    if (!context || !definition) {
      return;
    }

    if (context.state !== "running") {
      try {
        await context.resume();
      } catch {
        return;
      }
    }

    if (context.state !== "running") {
      return;
    }

    const now = Date.now();
    const categoryLastAt = this.lastCategoryPlayAt.get(definition.category) ?? 0;
    const soundLastAt = this.lastSoundPlayAt.get(id) ?? 0;
    const categoryThrottleMs = CATEGORY_THROTTLE_MS[definition.category];
    const soundThrottleMs = options?.throttleMs ?? categoryThrottleMs;

    if (now - this.lastGlobalPlayAt < GLOBAL_THROTTLE_MS) {
      return;
    }
    if (now - categoryLastAt < categoryThrottleMs) {
      return;
    }
    if (now - soundLastAt < soundThrottleMs) {
      return;
    }

    const buffer = await this.getBuffer(id);
    if (!buffer || !this.masterGain) {
      return;
    }

    this.lastGlobalPlayAt = now;
    this.lastCategoryPlayAt.set(definition.category, now);
    this.lastSoundPlayAt.set(id, now);

    const source = context.createBufferSource();
    const nodeGain = context.createGain();
    const multiplier = options?.volumeMultiplier ?? 1;

    source.buffer = buffer;
    nodeGain.gain.value = Math.max(0, definition.baseVolume * multiplier);
    source.connect(nodeGain);
    nodeGain.connect(this.masterGain);
    source.start(0);
  }

  private async getBuffer(id: UiSoundId): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) {
      return cached;
    }

    const existingLoad = this.loadingBuffers.get(id);
    if (existingLoad) {
      return existingLoad;
    }

    const context = this.getOrCreateContext();
    const definition = SOUND_DEFINITIONS[id];
    if (!context || !definition) {
      return null;
    }

    const load = (async (): Promise<AudioBuffer | null> => {
      try {
        const response = await fetch(definition.src, { cache: "force-cache" });
        if (!response.ok) {
          return null;
        }
        const bytes = await response.arrayBuffer();
        const decoded = await context.decodeAudioData(bytes.slice(0));
        this.buffers.set(id, decoded);
        return decoded;
      } catch {
        return null;
      } finally {
        this.loadingBuffers.delete(id);
      }
    })();

    this.loadingBuffers.set(id, load);
    return load;
  }

  private getOrCreateContext(): AudioContext | null {
    if (!isBrowser() || !this.supportsAudio) {
      return null;
    }

    if (!this.context) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return null;
      }
      this.context = new AudioContextCtor();
    }

    if (!this.masterGain) {
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.settings.volume;
      this.masterGain.connect(this.context.destination);
    }

    return this.context;
  }

  private attachUnlockListeners(): void {
    if (!isBrowser() || this.unlockListenersAttached) {
      return;
    }

    this.unlockHandler = () => {
      void this.unlock();
    };

    window.addEventListener("pointerdown", this.unlockHandler, { passive: true });
    window.addEventListener("keydown", this.unlockHandler, { passive: true });
    window.addEventListener("touchstart", this.unlockHandler, { passive: true });
    this.unlockListenersAttached = true;
  }

  private detachUnlockListeners(): void {
    if (!isBrowser() || !this.unlockListenersAttached) {
      return;
    }

    if (this.unlockHandler) {
      window.removeEventListener("pointerdown", this.unlockHandler);
      window.removeEventListener("keydown", this.unlockHandler);
      window.removeEventListener("touchstart", this.unlockHandler);
      this.unlockHandler = null;
    }
    this.unlockListenersAttached = false;
  }

  private attachLifecycleListeners(): void {
    if (!isBrowser()) {
      return;
    }

    const resumeIfNeeded = () => {
      if (!this.context || !this.isUnlocked) {
        return;
      }
      if (this.context.state === "suspended") {
        void this.unlock();
      }
    };

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        resumeIfNeeded();
      }
    });
    window.addEventListener("pageshow", () => {
      resumeIfNeeded();
    });
  }

  private readPersistedSettings(): UiSfxSettings {
    if (!isBrowser()) {
      return DEFAULT_SETTINGS;
    }

    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      if (!raw) {
        return DEFAULT_SETTINGS;
      }
      const parsed = JSON.parse(raw) as Partial<UiSfxSettings>;
      return {
        enabled: parsed.enabled ?? DEFAULT_SETTINGS.enabled,
        volume: clampVolume(parsed.volume ?? DEFAULT_SETTINGS.volume)
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  private persistSettings(): void {
    if (!isBrowser()) {
      return;
    }

    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore persistence failures silently.
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

let singleton: UiSfxManager | null = null;

export function getUiSfxManager(): UiSfxManager {
  if (!singleton) {
    singleton = new UiSfxManager();
  }
  return singleton;
}

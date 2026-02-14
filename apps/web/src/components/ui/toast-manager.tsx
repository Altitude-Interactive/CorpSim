"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useUiSfx } from "@/components/layout/ui-sfx-provider";
import { UiSoundId } from "@/lib/ui-sfx";
import { cn } from "@/lib/utils";
import { Button } from "./button";

type ToastVariant = "success" | "error" | "warning" | "info";
type ToastSound = "auto" | "none" | UiSoundId;
export type PopupBackdrop = "blur" | "solid";
export type PopupVariant = "default" | "danger";
type PopupResult = "confirm" | "cancel";
type NoticeVariant = "info" | "warning" | "danger" | "success";

interface ToastEntry {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface PopupEntry {
  id: number;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string | null;
  backdrop: PopupBackdrop;
  variant: PopupVariant;
  dismissible: boolean;
  resolve: (result: PopupResult) => void;
}

interface PopupOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  backdrop?: PopupBackdrop;
  variant?: PopupVariant;
  dismissible?: boolean;
  sound?: ToastSound;
}

interface ToastManagerContextValue {
  showToast: (input: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    sound?: ToastSound;
  }) => void;
  openPopup: (input: PopupOptions) => Promise<PopupResult>;
  showPopup: (input: Omit<PopupOptions, "cancelLabel">) => Promise<void>;
  confirmPopup: (input: PopupOptions) => Promise<boolean>;
}

const ToastManagerContext = createContext<ToastManagerContextValue | null>(null);

const toastVariantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-600/40 bg-emerald-900/30 text-emerald-100",
  error: "border-red-600/40 bg-red-900/30 text-red-100",
  warning: "border-amber-600/40 bg-amber-900/30 text-amber-100",
  info: "border-blue-600/40 bg-blue-900/30 text-blue-100"
};

const popupVariantStyles: Record<PopupVariant, string> = {
  default: "border-slate-600/80 bg-slate-900/95 text-slate-100",
  danger: "border-red-700/70 bg-slate-900/95 text-slate-100"
};

const popupBackdropStyles: Record<PopupBackdrop, string> = {
  blur: "bg-slate-950/80 backdrop-blur-sm",
  solid: "bg-slate-950/80"
};

const noticeVariantStyles: Record<NoticeVariant, string> = {
  info: "border-blue-600/35 bg-blue-950/25 text-blue-100",
  warning: "border-amber-600/35 bg-amber-950/25 text-amber-100",
  danger: "border-red-700/35 bg-red-950/25 text-red-100",
  success: "border-emerald-700/35 bg-emerald-950/25 text-emerald-100"
};

interface ToastNoticeProps {
  title: string;
  description?: React.ReactNode;
  variant?: NoticeVariant;
  action?: React.ReactNode;
  className?: string;
}

export function ToastNotice({
  title,
  description,
  variant = "info",
  action,
  className
}: ToastNoticeProps) {
  return (
    <div className={cn("rounded-md border px-4 py-3", noticeVariantStyles[variant], className)}>
      <p className="text-sm font-semibold">{title}</p>
      {description ? <div className="mt-1 text-sm opacity-90">{description}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

interface ToastOverlayProps {
  backdrop?: PopupBackdrop;
  variant?: PopupVariant;
  layerClassName?: string;
  panelClassName?: string;
  labelledBy?: string;
  describedBy?: string;
  onBackdropMouseDown?: () => void;
  children: React.ReactNode;
}

export function ToastOverlay({
  backdrop = "solid",
  variant = "default",
  layerClassName,
  panelClassName,
  labelledBy,
  describedBy,
  onBackdropMouseDown,
  children
}: ToastOverlayProps) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-[9600] flex items-center justify-center p-6",
        popupBackdropStyles[backdrop],
        layerClassName
      )}
      onMouseDown={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        onBackdropMouseDown?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={cn(
          "w-full max-w-xl rounded-2xl border p-6 shadow-2xl shadow-black/60",
          popupVariantStyles[variant],
          panelClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

function playAutoToastSound(play: (soundId: UiSoundId) => void, variant: ToastVariant): void {
  if (variant === "success") {
    play("feedback_success");
    return;
  }
  if (variant === "warning") {
    play("feedback_warning");
    return;
  }
  if (variant === "error") {
    play("feedback_error");
    return;
  }
  play("feedback_neutral");
}

function playPopupSound(
  play: (soundId: UiSoundId) => void,
  sound: ToastSound | undefined,
  backdrop: PopupBackdrop,
  variant: PopupVariant
): void {
  if (sound === "none") {
    return;
  }
  if (sound && sound !== "auto") {
    play(sound);
    return;
  }

  if (variant === "danger") {
    play("feedback_warning");
    return;
  }
  if (backdrop === "blur") {
    play("ui_open");
    return;
  }
  play("feedback_neutral");
}

export function ToastManagerProvider({ children }: { children: React.ReactNode }) {
  const { play } = useUiSfx();
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const [popupQueue, setPopupQueue] = useState<PopupEntry[]>([]);

  const activePopup = popupQueue[0] ?? null;

  const closeActivePopup = useCallback(
    (result: PopupResult) => {
      let resolver: ((value: PopupResult) => void) | null = null;
      setPopupQueue((prev) => {
        const current = prev[0];
        if (!current) {
          return prev;
        }
        resolver = current.resolve;
        return prev.slice(1);
      });
      if (resolver) {
        resolver(result);
        play("ui_close");
      }
    },
    [play]
  );

  useEffect(() => {
    if (!activePopup || !activePopup.dismissible || activePopup.cancelLabel === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeActivePopup("cancel");
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [activePopup, closeActivePopup]);

  const showToast = useCallback(
    (input: { title: string; description?: string; variant?: ToastVariant; sound?: ToastSound }) => {
      const variant = input.variant ?? "info";
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const next: ToastEntry = {
        id,
        title: input.title,
        description: input.description,
        variant
      };

      const sound = input.sound ?? "auto";
      if (sound !== "none") {
        if (sound === "auto") {
          playAutoToastSound(play, variant);
        } else {
          play(sound);
        }
      }

      setToasts((prev) => [...prev, next]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 3_500);
    },
    [play]
  );

  const openPopup = useCallback(
    async (input: PopupOptions): Promise<PopupResult> => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const backdrop = input.backdrop ?? "solid";
      const variant = input.variant ?? "default";
      playPopupSound(play, input.sound, backdrop, variant);

      return new Promise<PopupResult>((resolve) => {
        const entry: PopupEntry = {
          id,
          title: input.title,
          description: input.description,
          confirmLabel: input.confirmLabel ?? "Continue",
          cancelLabel: input.cancelLabel === undefined ? "Cancel" : input.cancelLabel,
          backdrop,
          variant,
          dismissible: input.dismissible ?? true,
          resolve
        };

        setPopupQueue((prev) => [...prev, entry]);
      });
    },
    [play]
  );

  const showPopup = useCallback(
    async (input: Omit<PopupOptions, "cancelLabel">): Promise<void> => {
      await openPopup({
        ...input,
        cancelLabel: null,
        dismissible: false
      });
    },
    [openPopup]
  );

  const confirmPopup = useCallback(
    async (input: PopupOptions): Promise<boolean> => {
      const result = await openPopup(input);
      return result === "confirm";
    },
    [openPopup]
  );

  const value = useMemo<ToastManagerContextValue>(
    () => ({
      showToast,
      openPopup,
      showPopup,
      confirmPopup
    }),
    [confirmPopup, openPopup, showPopup, showToast]
  );

  return (
    <ToastManagerContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[9500] flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto rounded-md border px-3 py-2 shadow-lg backdrop-blur-sm",
              toastVariantStyles[toast.variant]
            )}
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? <p className="text-xs opacity-90">{toast.description}</p> : null}
          </div>
        ))}
      </div>

      {activePopup ? (
        <ToastOverlay
          backdrop={activePopup.backdrop}
          variant={activePopup.variant}
          onBackdropMouseDown={() => {
            if (!activePopup.dismissible || activePopup.cancelLabel === null) {
              return;
            }
            closeActivePopup("cancel");
          }}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">
            {activePopup.backdrop === "blur" ? "Important notice" : "Confirm action"}
          </p>
          <h2 className="mt-2 text-xl font-semibold">{activePopup.title}</h2>
          {activePopup.description ? (
            <p className="mt-3 text-sm leading-6 text-slate-200">{activePopup.description}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            {activePopup.cancelLabel ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => closeActivePopup("cancel")}
              >
                {activePopup.cancelLabel}
              </Button>
            ) : null}
            <Button
              type="button"
              variant={activePopup.variant === "danger" ? "destructive" : "default"}
              onClick={() => closeActivePopup("confirm")}
            >
              {activePopup.confirmLabel}
            </Button>
          </div>
        </ToastOverlay>
      ) : null}
    </ToastManagerContext.Provider>
  );
}

export function useToastManager() {
  const context = useContext(ToastManagerContext);
  if (!context) {
    throw new Error("useToastManager must be used inside ToastManagerProvider");
  }
  return context;
}

export function useToast() {
  return useToastManager();
}

export const ToastProvider = ToastManagerProvider;

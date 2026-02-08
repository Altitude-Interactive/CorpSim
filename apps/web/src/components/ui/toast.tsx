"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface ToastEntry {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastVariantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-600/40 bg-emerald-900/30 text-emerald-100",
  error: "border-red-600/40 bg-red-900/30 text-red-100",
  info: "border-blue-600/40 bg-blue-900/30 text-blue-100"
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const showToast = useCallback(
    (input: { title: string; description?: string; variant?: ToastVariant }) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const next: ToastEntry = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "info"
      };

      setToasts((prev) => [...prev, next]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 3_000);
    },
    []
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "rounded-md border px-3 py-2 shadow-lg backdrop-blur-sm",
              toastVariantStyles[toast.variant]
            )}
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.description ? <p className="text-xs opacity-90">{toast.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

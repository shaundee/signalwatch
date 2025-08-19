"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type ToastVariant = "success" | "error" | "info";
type Toast = {
  id: number;
  message: string;
  title?: string;
  variant?: ToastVariant;
  duration?: number; // ms
};

type ToastContextType = {
  toast: (opts: Omit<Toast, "id"> | string) => number;
  success: (message: string, opts?: Omit<Toast, "id" | "message" | "variant">) => number;
  error:   (message: string, opts?: Omit<Toast, "id" | "message" | "variant">) => number;
  info:    (message: string, opts?: Omit<Toast, "id" | "message" | "variant">) => number;
  remove: (id: number) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((input: Omit<Toast, "id"> | string) => {
    const id = idRef.current++;
    const t: Toast =
      typeof input === "string"
        ? { id, message: input, variant: "info", duration: 3500 }
        : { id, duration: 3500, variant: "info", ...input };

    setToasts((arr) => [...arr, t]);
    if (t.duration && t.duration > 0) {
      setTimeout(() => remove(id), t.duration);
    }
    return id;
  }, [remove]);

  const api = useMemo<ToastContextType>(() => ({
    toast: push,
    success: (message, opts) => push({ message, variant: "success", duration: 3500, ...(opts ?? {}) }),
    error:   (message, opts) => push({ message, variant: "error",   duration: 5000, ...(opts ?? {}) }),
    info:    (message, opts) => push({ message, variant: "info",    duration: 3500, ...(opts ?? {}) }),
    remove,
  }), [push, remove]);

  // Optional: trim if >6 stacked
  useEffect(() => {
    if (toasts.length > 6) setToasts((t) => t.slice(-6));
  }, [toasts.length]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map(({ id, message, title, variant }) => (
          <div
            key={id}
            className={[
              "pointer-events-auto rounded-2xl border p-3 shadow-sm backdrop-blur transition-all",
              "bg-white/90",
              variant === "success" ? "border-emerald-300" : "",
              variant === "error"   ? "border-rose-300"    : "",
              variant === "info"    ? "border-zinc-300"    : "",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <span
                className={[
                  "mt-1 inline-block h-2.5 w-2.5 rounded-full",
                  variant === "success" ? "bg-emerald-600" : "",
                  variant === "error"   ? "bg-rose-600"    : "",
                  variant === "info"    ? "bg-zinc-600"    : "",
                ].join(" ")}
              />
              <div className="flex-1 text-sm text-zinc-800">
                {title && <div className="font-medium">{title}</div>}
                <div className="text-zinc-700">{message}</div>
              </div>
              <button
                onClick={() => remove(id)}
                className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

type Toast = { id: number; msg: string; tone: "info" | "success" | "error" };
type Ctx = { info: (m: string) => void; success: (m: string) => void; error: (m: string) => void };
const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], msg: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, msg, tone }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3000);
  }, []);
  const ctx: Ctx = {
    info: (m) => push("info", m),
    success: (m) => push("success", m),
    error: (m) => push("error", m),
  };

  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex justify-center">
        <div className="flex max-w-lg flex-col gap-2">
          {list.map((t) => (
            <div
              key={t.id}
              className={
                "pointer-events-auto rounded-xl px-4 py-2 text-sm shadow " +
                (t.tone === "success"
                  ? "bg-emerald-100 text-emerald-900"
                  : t.tone === "error"
                  ? "bg-rose-100 text-rose-900"
                  : "bg-zinc-100 text-zinc-900")
              }
            >
              {t.msg}
            </div>
          ))}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const v = useContext(ToastCtx);
  if (!v) throw new Error("ToastProvider missing");
  return v;
}

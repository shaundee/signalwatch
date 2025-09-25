// lib/usePeekPoll.ts
import { useEffect, useRef } from "react";
declare global { interface Window { __swPeekTimer?: number; __swPeekLast?: number; } }

export function usePeekPoll(fetchPeek: () => Promise<void>, ms = 2000) {
  const cbRef = useRef(fetchPeek);
  cbRef.current = fetchPeek;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const visible = () => document.visibilityState === "visible";
    let inflight: AbortController | null = null;

    const tick = async () => {
      const now = Date.now();
      if (!visible()) return;
      if (window.__swPeekLast && now - window.__swPeekLast < ms) return; // skip too soon
      window.__swPeekLast = now;
      if (inflight) inflight.abort();
      inflight = new AbortController();
      try { await cbRef.current(); } finally { inflight = null; }
    };

    if (!window.__swPeekTimer) {
      window.__swPeekTimer = window.setInterval(tick, ms) as unknown as number;
      tick();
    }
    const onVis = () => { if (visible()) tick(); };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      // do NOT clear interval here—in dev HMR this unmounts/remounts; leaving the singleton keeps it stable.
    };
  }, [ms]);
}

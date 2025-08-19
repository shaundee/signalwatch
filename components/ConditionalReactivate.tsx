"use client";
import { useEffect, useState } from "react";
import ReactivateSubscriptionButton from "@/components/ReactivateSubscriptionButton";

type Res =
  | { found: true; cancel_at_period_end?: boolean | null }
  | { found: false }
  | { error: string };

export default function ConditionalReactivate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/subscription-status", { credentials: "include" });
        const j: Res = await r.json();
        setShow(!!(j && "found" in j && j.found && j.cancel_at_period_end === true));
      } catch {
        setShow(false);
      }
    })();
  }, []);

  if (!show) return null;
  return <ReactivateSubscriptionButton />;
}

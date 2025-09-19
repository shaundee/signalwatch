"use client";
import { useCallback, useEffect, useState } from "react";
import ReactivateSubscriptionButton from "@/components/ReactivateSubscriptionButton";

type Res =
  | { found: true; scheduled_to_cancel?: boolean | null }
  | { found: false }
  | { error: string };

export default function ConditionalReactivate() {
  const [show, setShow] = useState(false);

  const check = useCallback(async () => {
    try {
      const r = await fetch(`/api/subscription-status?ts=${Date.now()}`, { credentials: "include" });
      const j: any = await r.json();
      setShow(!!(j && "found" in j && j.found && j.scheduled_to_cancel === true));
    } catch {
      setShow(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  const handleReactivated = useCallback(() => {
    setShow(false);             // hide immediately
    setTimeout(check, 400);     // confirm with server shortly after
  }, [check]);

  if (!show) return null;
  return <ReactivateSubscriptionButton onReactivated={handleReactivated} />;
}

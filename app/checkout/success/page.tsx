"use client";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import ManageBillingButton from "@/components/ManageBillingButton";
import { useToast } from "@/components/ui/ToastProvider";

export default function Success() {
  const params = useSearchParams();
  const { success } = useToast();
  const sessionId = params.get("session_id");

  useEffect(() => {
    success("Payment successful — your subscription is active!");
  }, [success]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Thanks! 🎉</h1>
      <p className="mt-2 text-zinc-600">
        You can manage your plan any time in the Customer Portal.
      </p>
      <div className="mt-6">
        {/* Our ManageBillingButton already reads ?session_id=... as a fallback */}
        <ManageBillingButton />
      </div>
      {!sessionId && (
        <p className="mt-3 text-xs text-zinc-500">
          Tip: If you don’t see the portal, start from the Dashboard or Pricing page.
        </p>
      )}
    </div>
  );
}

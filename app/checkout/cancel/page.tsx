"use client";
import Link from "next/link";
import { useToast } from "@/components/ui/ToastProvider";

export default function Cancel() {
  const { info } = useToast();
  // fire once for feedback
  info("Checkout canceled — no charges made.");

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">No worries</h1>
      <p className="mt-2 text-zinc-600">
        You can subscribe any time — your account is still available.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/pricing" className="btn">Back to pricing</Link>
        <Link href="/dashboard" className="px-4 py-2 rounded-2xl border border-zinc-300 hover:bg-zinc-50">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}

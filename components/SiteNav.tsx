"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Route } from "next";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useToast } from "@/components/ui/ToastProvider";

const R = { home: "/" as Route, pricing: "/pricing" as Route, dash: "/dashboard" as Route, signin: "/signin" as Route };

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const { success, error: toastError } = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setEmail(data.user?.email ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const link = (href: string) =>
    `px-3 py-2 rounded-xl ${pathname === href ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`;

  async function signOut() {
    try {
      setBusy(true);
      await supabase.auth.signOut();
      await fetch("/api/auth/signout", { method: "POST" });
      success("Signed out.");
      router.replace(R.signin);
    } catch (e: any) {
      toastError(e?.message || "Could not sign out");
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href={R.home} className="text-lg font-bold tracking-tight">SignalWatch</Link>
     <Link href="/" className="font-semibold">SignalWatch</Link>
<nav className="flex items-center gap-6 text-sm">
  <Link href="/scan">Run audit</Link>
  {/* keep pricing later; remove Dashboard for now */}
  {/* <Link href="/pricing">Pricing</Link> */}
  {/* <Link href="/dashboard">Dashboard</Link> */}
  <Link href="/signin" className="rounded-xl px-3 py-1 border">Sign in</Link>
</nav>
      </div>
    </header>
  );
}

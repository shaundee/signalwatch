"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Route } from "next";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useToast } from "@/components/ui/ToastProvider";

const routes = {
  home: "/" as Route,
  pricing: "/pricing" as Route,
  dashboard: "/dashboard" as Route,
  signin: "/signin" as Route,
};

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = supabaseBrowser();
  const { info, error: toastError, success } = useToast();

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Keep navbar in sync with auth state
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserEmail(data.user?.email ?? null);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const linkCls = (href: string) =>
    `px-3 py-2 rounded-xl ${pathname === href ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`;

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await supabase.auth.signOut();                      // clear client session
      await fetch("/api/auth/signout", { method: "POST" }); // clear httpOnly cookies
      success("Signed out.");
      router.replace(routes.signin);
    } catch (e: any) {
      toastError(e?.message || "Could not sign out");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href={routes.home} className="text-lg font-bold tracking-tight">
          Trackify
        </Link>

        <nav className="flex items-center gap-3 text-sm">
          <Link href={routes.pricing} className={linkCls("/pricing")}>Pricing</Link>
          <Link href={routes.dashboard} className={linkCls("/dashboard")}>Dashboard</Link>

          {userEmail ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-zinc-600">{userEmail}</span>
              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="px-3 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
                title="Sign out"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : (
            <Link href={routes.signin} className="btn">Sign in</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

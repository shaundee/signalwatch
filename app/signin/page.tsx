"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { useToast } from "@/components/ui/ToastProvider";
import type { Route } from "next";

const ALLOWED: Route[] = [
  "/" as Route,
  "/signin" as Route,
  "/dashboard" as Route,
  "/pricing" as Route,
];
function toRoute(s: string | null, fallback: Route = "/dashboard" as Route): Route {
  return (s && (ALLOWED as readonly string[]).includes(s)) ? (s as Route) : fallback;
}

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = supabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const { success, error } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setBusy(true);
      const { error: err } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (err) throw err;
      success("Signed in!");
     // ...
const back = toRoute(params.get("redirectedFrom"));
router.replace(back); // ✅
    } catch (e: any) {
      error(e?.message || "Invalid login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <input className="w-full rounded-xl border px-3 py-2" type="email" placeholder="you@example.com" value={email} onChange={(e)=>setEmail(e.target.value)} />
        <input className="w-full rounded-xl border px-3 py-2" type="password" placeholder="••••••••" value={pw} onChange={(e)=>setPw(e.target.value)} />
        <button className="btn w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}

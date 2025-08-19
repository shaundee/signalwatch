"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/SupabaseBrowser";

export default function SignIn() {
  const supabase = supabaseBrowser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  async function submit() {
    setStatus(mode === "signin" ? "Signing in…" : "Creating account…");
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

    const { error } = await fn;
    setStatus(error ? `Error: ${error.message}` : "Success! You can go to your dashboard.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStatus("Signed out.");
  }

  return (
    <div className="card max-w-md mx-auto space-y-3">
      <h1 className="text-2xl font-bold">Sign {mode === "signin" ? "in" : "up"}</h1>
      <input
        className="w-full border rounded-lg p-2"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full border rounded-lg p-2"
        placeholder="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <div className="flex gap-2">
        <button className="btn" onClick={submit}>
          {mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button className="btn" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          Switch to {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
      {status && <p className="text-sm text-gray-600">{status}</p>}
    </div>
  );
}

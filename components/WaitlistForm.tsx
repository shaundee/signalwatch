"use client";
import { useState } from "react";

export default function WaitlistForm({ source }: { source?: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [ok, setOk] = useState<null | "ok" | "error">(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setOk(null);
    try {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, source }),
      });
      if (!r.ok) throw new Error("bad");
      setOk("ok");
      setEmail("");
      setName("");
    } catch {
      setOk("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        placeholder="you@store.co.uk"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full flex-1 rounded-md border border-zinc-300 bg-white px-4 py-2 text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {loading ? "Adding..." : "Get updates"}
      </button>
      {ok === "ok" && <p className="text-sm text-green-600">Added! Check your email soon.</p>}
      {ok === "error" && <p className="text-sm text-red-600">Something went wrong. Try again.</p>}
    </form>
  );
}

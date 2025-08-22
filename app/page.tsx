import Link from "next/link";
import type { Route } from "next";

const routes = { pricing: "/pricing" as Route, dashboard: "/dashboard" as Route, signin: "/signin" as Route };

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="card">
        <h1 className="text-3xl font-bold tracking-tight">VatPilot</h1>
        <p className="mt-2 text-zinc-600">Track VAT and manage billing with Stripe + Supabase.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={routes.pricing} className="btn">View pricing</Link>
          <Link href={routes.dashboard} className="px-4 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50">
            Go to dashboard
          </Link>
          <Link href={routes.signin} className="px-4 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

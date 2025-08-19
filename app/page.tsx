import Link from "next/link";
import PayButton from "@/components/PayButton"; // ⬅ add this
import SubscribeButtons from "@/components/SubscribeButtons"; // ⬅ add this
import ManageBillingButton from "@/components/ManageBillingButton";
import ManageBillingFromDB from "@/components/ManageBillingFromDB";







export default function Home() {
  return (
    <div className="space-y-6">
      <PayButton />
      <SubscribeButtons />
      <ManageBillingButton />
      <ManageBillingFromDB />

      <div className="card">
        <h1 className="text-3xl font-bold">VATTrackify Starter</h1>
        <p className="mt-2 text-gray-600">
          Next.js + Supabase + Stripe + OAuth stubs for Shopify and HMRC.
        </p>
        <div className="mt-4 flex gap-3">
          <Link className="btn" href="/signin">Sign in</Link>
          <Link className="btn" href="/dashboard">Go to dashboard</Link>
          <Link className="btn" href="/api/shopify/auth">Connect Shopify</Link>
          <Link className="btn" href="/api/hmrc/auth">Connect HMRC</Link>
        </div>
      </div>
      <div className="card">
        <h2 className="text-xl font-semibold">Next steps</h2>
        <ol className="list-decimal ml-6 mt-2 space-y-1">
          <li>Fill <code>.env.local</code> (copy from <code>.env.example</code>).</li>
          <li>Run <code>npm run dev</code> and open <code>http://localhost:3000</code>.</li>
          <li>Test Stripe webhook: set <code>STRIPE_WEBHOOK_SECRET</code> then POST a test event.</li>
          <li>Set Shopify app callback to <code>/api/shopify/callback</code>.</li>
          <li>Set HMRC redirect to <code>/api/hmrc/callback</code>.</li>
        </ol>
      </div>
    </div>
  );
}

import { stripe } from "@/lib/stripe";
import { supabaseServer } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Success({ searchParams }: { searchParams: { session_id?: string } }) {
  const supa = supabaseServer();
  const { data: { user } } = await supa.auth.getUser();

  const sessionId = searchParams.session_id;
  if (user?.id && sessionId) {
    try {
      const sess = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
      const subId = typeof sess.subscription === "string" ? sess.subscription : sess.subscription?.id;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        const item = sub.items.data[0];
        const price = item?.price;
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;

        await supabaseAdmin.from("stripe_billing").upsert(
          {
            user_id: user.id,
            email: user.email ?? null,
            stripe_customer_id: customerId ?? null,
            stripe_subscription_id: sub.id,
            status: sub.status,
            plan: price?.recurring?.interval ?? null,
            price_id: price?.id ?? null,
            current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }
    } catch (e) {
      console.error("success upsert error:", e);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Success! 🎉</h1>
      <p className="mt-2 text-zinc-600">Your subscription was created.</p>
      <Link href="/dashboard" className="btn mt-6">Go to dashboard</Link>
    </div>
  );
}

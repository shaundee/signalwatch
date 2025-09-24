import { stripe } from "@/lib/stripe";

export async function getPricing() {
  const monthlyId = process.env.STRIPE_PRICE_MONTHLY!;
  const annualId  = process.env.STRIPE_PRICE_ANNUAL!;

  const [m, a] = await Promise.all([
    stripe.prices.retrieve(monthlyId, { expand: ["product"] }),
    stripe.prices.retrieve(annualId,  { expand: ["product"] }),
  ]);

  const fmt = (p: any) => ({
    amount: (p.unit_amount ?? 0) / 100,
    currency: (p.currency ?? "gbp").toUpperCase(),
    interval: p.recurring?.interval ?? "month",
    trialDays: p.recurring?.trial_period_days ?? null, // uses the Price's trial if set
  });

  return { monthly: fmt(m), annual: fmt(a) };
}

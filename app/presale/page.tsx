// app/presale/page.tsx
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const revalidate = 60;
export const metadata = {
  title: "VatPilot — Founding Member Presale",
  description:
    "File UK VAT from Shopify in minutes. Founding member presale for early adopters — £15/mo or £150/yr at launch.",
};

// helper near the top of app/presale/page.tsx
// helper
type LoomEmbed = { embed: string | null; raw: string | null };

function toLoomEmbed(raw?: string | null): LoomEmbed {
  if (!raw) return { embed: null, raw: null };
  try {
    const u = new URL(raw);
    if (!u.hostname.includes("loom.com")) return { embed: null, raw };
    if (u.pathname.startsWith("/share/")) {
      u.pathname = u.pathname.replace("/share/", "/embed/");
      return { embed: u.toString(), raw };
    }
    if (u.pathname.startsWith("/embed/")) return { embed: u.toString(), raw };
    return { embed: null, raw };
  } catch {
    return { embed: null, raw: raw ?? null };
  }
}


export default async function PresalePage() {
    
  // Seats reserved (from waitlist count)
  
  let reserved = 0;
  try {
    const { count } = await supabaseAdmin
      .from("waitlist")
      .select("id", { count: "exact", head: true });
    reserved = count ?? 0;
  } catch {}

  const cap = Number(process.env.NEXT_PUBLIC_FOUNDER_SEATS_CAP || 50);
  const depositUrl = process.env.NEXT_PUBLIC_PRESALE_PAYMENT_LINK || "";
  const { embed: loomEmbed, raw: loomRaw } = toLoomEmbed(process.env.NEXT_PUBLIC_LOOM_URL || null);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="mb-3 text-xs uppercase tracking-wide text-zinc-500">
        Founding member presale
      </p>
      <h1 className="text-3xl font-bold">VatPilot</h1>
      <p className="mt-2 text-zinc-600">
        File UK VAT from Shopify in minutes. Early adopters lock in founder pricing.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3 text-sm">
        <span className="rounded-full bg-zinc-100 px-3 py-1">
          Seats: <strong>{reserved}</strong> / {cap}
        </span>
        <span className="rounded-full bg-zinc-100 px-3 py-1">£15/mo</span>
        <span className="rounded-full bg-zinc-100 px-3 py-1">£150/yr</span>
      </div>

      <div className="mt-8">
        {depositUrl ? (
          <a
            className="inline-flex items-center rounded-md bg-black px-4 py-2 text-white hover:opacity-90"
            href={depositUrl}
            target="_blank"
            rel="noreferrer"
          >
            Reserve your seat — £10 (refundable)
          </a>
        ) : (
          <p className="text-sm text-zinc-500">
            <em>Set NEXT_PUBLIC_PRESALE_PAYMENT_LINK to show the Reserve button.</em>
          </p>
        )}
      </div>

{loomEmbed ? (
  <div className="mx-auto mt-10 overflow-hidden rounded-lg border">
    <div className="aspect-video w-full">
      <iframe
        src={loomEmbed}
        className="h-full w-full"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  </div>
) : loomRaw ? (
  <p className="mt-4 text-sm">
    Can’t embed this Loom here.{" "}
    <a className="underline" href={loomRaw} target="_blank" rel="noreferrer">Watch the demo</a>.
  </p>
) : null}


      <section className="mt-12 space-y-6">
        <div className="rounded-lg border p-5">
          <h3 className="font-semibold">What do I pay now?</h3>
          <p className="mt-1 text-sm text-zinc-600">
            A <strong>£10 refundable deposit</strong> to reserve founder pricing. It’s applied to
            your first month or year.
          </p>
        </div>

        <div className="rounded-lg border p-5">
          <h3 className="font-semibold">Pricing at launch</h3>
          <p className="mt-1 text-sm text-zinc-600">
            <strong>£15/month</strong> (7-day trial, once per customer) or{" "}
            <strong>£150/year</strong> (no trial, 14-day money-back).
          </p>
        </div>

        <div className="rounded-lg border p-5">
          <h3 className="font-semibold">MTD status</h3>
          <p className="mt-1 text-sm text-zinc-600">
            Launching with a correct, accountant-ready export and full audit trail. HMRC MTD bridging
            comes next.
          </p>
        </div>
      </section>

      <footer className="mt-20 border-t pt-6 text-center text-sm text-zinc-600">
        © {new Date().getFullYear()} VatPilot ·{" "}
        <Link className="underline" href="/privacy">
          Privacy
        </Link>{" "}
        ·{" "}
        <Link className="underline" href="/refund-policy">
          Refund policy
        </Link>
      </footer>
    </main>
  );
}

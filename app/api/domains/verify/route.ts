import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fetchText(url: string, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
  finally { clearTimeout(t); }
}

export async function POST(req: NextRequest) {
  const { domainId } = await req.json().catch(() => ({}));
  if (!domainId) return NextResponse.json({ error: "domainId required" }, { status: 400 });

  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
  const { data: d, error } = await supa.from("domains").select("id,url,verify_token").eq("id", domainId).single();
  if (error || !d?.verify_token) return NextResponse.json({ error: "domain_not_found_or_no_token" }, { status: 404 });

  const base = new URL(d.url);
  // Check meta tag on homepage
  const html = await fetchText(`${base.origin}/`);
  const metaOK = html?.includes(`name="signalwatch-verify"`) && html?.includes(`content="${d.verify_token}"`);

  // Or well-known file
  const txt = await fetchText(`${base.origin}/.well-known/signalwatch.txt`);
  const fileOK = txt?.trim() === d.verify_token;

  if (!metaOK && !fileOK) {
    return NextResponse.json({ ok: false, verified: false });
  }

  await supa.from("domains").update({ verified_at: new Date().toISOString() }).eq("id", d.id);
  return NextResponse.json({ ok: true, verified: true });
}

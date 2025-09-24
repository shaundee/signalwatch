import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

export async function POST(req: Request) {
  const { email, source } = await req.json().catch(() => ({}));
  if (!email || !/^\S+@\S+\.\S+$/.test(email))
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const { error } = await supa
    .from("emails")
    .insert({ email, source: source || "landing" });

  if (error && !/duplicate/i.test(error.message))
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, name, source } = await req.json();
    if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    await supabaseAdmin.from("waitlist").insert({
      email: email.trim().toLowerCase(),
      name: typeof name === "string" ? name.trim() : null,
      source: typeof source === "string" ? source.slice(0, 120) : null,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // ignore duplicate email gracefully
    if (e?.message?.includes("duplicate key")) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("waitlist error:", e?.message || e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

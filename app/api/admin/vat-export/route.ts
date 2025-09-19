import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopId = url.searchParams.get("shopId");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!shopId || !from || !to) return new NextResponse("Missing params", { status: 400 });

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: n => cookieStore.get(n)?.value, set: () => {}, remove: () => {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { data: vr } = await supabase
    .from("vat_returns")
    .select("*").eq("shop_id", shopId).eq("period_start", from).eq("period_end", to)
    .maybeSingle();

  if (!vr) return new NextResponse("No return", { status: 404 });

  const rows = [
    ["Box","Amount"],
    ["1", vr.box1],["2", vr.box2],["3", vr.box3],["4", vr.box4],["5", vr.box5],
    ["6", vr.box6],["7", vr.box7],["8", vr.box8],["9", vr.box9],
  ];
  const csv = rows.map(r => r.join(",")).join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="vat_${from}_${to}.csv"`,
    },
  });
}

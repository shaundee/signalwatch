// app/s/[token]/page.tsx
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
export const runtime="nodejs"; export const dynamic="force-dynamic";

export default async function Share({ params }: { params: { token: string } }) {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
  const { data } = await supa.from("report_shares").select("scan_id").eq("token", params.token).limit(1).maybeSingle();
  if (!data) return redirect("/");
  return redirect(`/r/${data.scan_id}`);
}

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

export async function ensureDomainWithToken(accountId: string, url: string) {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
  // upsert or fetch
  const { data: got, error } = await supa
    .from("domains")
    .upsert({ account_id: accountId, url }, { onConflict: "account_id,url" })
    .select("id, verify_token, verified_at")
    .maybeSingle();
  if (error || !got) throw new Error(error?.message || "domain_upsert_failed");

  if (!got.verify_token) {
    const token = crypto.randomBytes(16).toString("hex");
    await supa.from("domains").update({ verify_token: token }).eq("id", got.id);
    return { id: got.id, token, verified_at: got.verified_at as string | null };
  }
  return { id: got.id, token: got.verify_token as string, verified_at: got.verified_at as string | null };
}

// lib/rateLimit.ts
import { createClient } from "@supabase/supabase-js";

export async function simpleRateLimit(route: string, ip: string, limit = 30) {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE!);
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString(); // minute bucket

  // upsert counter
  const { data, error } = await supa.rpc("fn_increment_counter", { p_route: route, p_ip: ip, p_window_start: windowStart });
  if (error) throw error;
  return (data as number) <= limit;
}

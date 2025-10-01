// lib/account.ts
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createRouteHandlerClient} from "@supabase/auth-helpers-nextjs";

/**
 * Resolve { accountId, account } for the current request.
 * - If the user is authenticated, use (or create) their workspace + membership.
 * - If anonymous, use DEFAULT_ACCOUNT_ID (or create a "Public" account).
 */
export async function resolveAccountForRequest() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  );

  // Try to read the signed-in user (non-fatal if not logged in)
  let userId: string | null = null;
  try {
    const supa = createRouteHandlerClient({ cookies });
    const { data } = await supa.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // auth helpers not installed or no session; treat as anon
  }

  if (userId) {
    // existing membership?
    const { data: au } = await admin
      .from("account_users")
      .select("account_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (au?.account_id) {
      const { data: account } = await admin
        .from("accounts")
        .select("*")
        .eq("id", au.account_id)
        .single();
      return { accountId: au.account_id, account };
    }

    // create account + membership for this user
    const { data: account } = await admin
      .from("accounts")
      .insert({ name: "My Workspace", tier: "free" })
      .select("*")
      .single();

    if (account) {
      await admin
        .from("account_users")
        .insert({ account_id: account.id, user_id: userId, role: "owner" });
      return { accountId: account.id, account };
    }
  }

  // Anonymous: use configured default, or create/find "Public"
  let defaultId = process.env.DEFAULT_ACCOUNT_ID || null;

  if (!defaultId) {
    const { data: existing } = await admin
      .from("accounts")
      .select("id")
      .eq("name", "Public")
      .maybeSingle();

    if (existing?.id) {
      defaultId = existing.id;
    } else {
      const { data: created } = await admin
        .from("accounts")
        .insert({ name: "Public", tier: "free" })
        .select("id")
        .single();
      defaultId = created!.id;
    }
  }

  const { data: account } = await admin
    .from("accounts")
    .select("*")
    .eq("id", defaultId!)
    .single();

  return { accountId: defaultId!, account };
}

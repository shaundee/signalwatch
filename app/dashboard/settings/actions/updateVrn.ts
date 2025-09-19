// ┌───────────────────────────────────────────────────────────┐
// │ File: app/(dashboard)/settings/actions/updateVrn.ts       │
// └───────────────────────────────────────────────────────────┘
'use server';

import { createClient } from '@supabase/supabase-js';

export type UpdateVrnInput = {
  shopDomain: string;
  vrn: string; // 9 digits
};

export type UpdateVrnResult = { ok: true } | { ok: false; error: string };

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function updateVrn({ shopDomain, vrn }: UpdateVrnInput): Promise<UpdateVrnResult> {
  if (!shopDomain) return { ok: false, error: 'Missing shop domain' };
  if (!/^[0-9]{9}$/.test(vrn)) return { ok: false, error: 'VRN must be 9 digits' };

  const supabase = sb();

  const { error } = await supabase
    .from('shops')
    .upsert({ shop_domain: shopDomain, vrn })
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

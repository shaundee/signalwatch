// ┌───────────────────────────────────────────────────────────┐
// │ File: app/dashboard/settings/tax/page.tsx               │
// └───────────────────────────────────────────────────────────┘
import { redirect } from 'next/navigation';
import { updateVrn } from '@/app/dashboard/settings/actions/updateVrn';
import SettingsFeedback from '@/components/SettingsFeedback';

export const dynamic = 'force-dynamic';

async function save(formData: FormData) {
  'use server';
  const shopDomain = String(formData.get('shopDomain') || '');
  const vrn = String(formData.get('vrn') || '');

  const res = await updateVrn({ shopDomain, vrn });
  const q = new URLSearchParams({ saved: res.ok ? '1' : '0', msg: res.ok ? 'ok' : (res as any).error || 'error' });
 redirect(`/dashboard/settings/tax?${q.toString()}`);
}

async function loadShop(shopDomain: string) {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await supabase
    .from('shops')
    .select('shop_domain, vrn')
    .eq('shop_domain', shopDomain)
    .maybeSingle();
  return data || null;
}

export default async function TaxSettingsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const shopDomain = (searchParams?.shopDomain as string) || '';
  const existing = shopDomain ? await loadShop(shopDomain) : null;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Tax Settings</h1>
      <form action={save} className="space-y-4">
        <div className="grid gap-2">
          <label className="text-sm">Shop Domain</label>
          <input
            name="shopDomain"
            defaultValue={existing?.shop_domain || shopDomain}
            placeholder="example.myshopify.com"
            className="border rounded-xl px-3 py-2 w-full"
            required
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm">VAT Registration Number (VRN)</label>
          <input
            name="vrn"
            defaultValue={existing?.vrn || ''}
            placeholder="9 digits, e.g. 123456789"
            pattern="^[0-9]{9}$"
            title="VRN must be 9 digits"
            className="border rounded-xl px-3 py-2 w-full"
            required
          />
          <p className="text-xs text-gray-500">We store this to auto-fill HMRC submissions and obligations.</p>
        </div>
<button
  type="submit"
  className="px-4 py-2 rounded-2xl shadow-md text-white bg-black hover:bg-gray-900 active:scale-[0.99] transition disabled:opacity-60"
>
  Save
</button>

<SettingsFeedback />

      </form>
      
    </div>
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
const sb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth:{persistSession:false} });

async function getShopToken(shopDomain: string) {
  const { data, error } = await sb().from('shop')
    .select('access_token').eq('shop_domain', shopDomain).limit(1);
  if (error) throw new Error(error.message);
  const row = data?.[0];
  if (!row?.access_token) throw new Error('No Shopify access_token stored for shop');
  return row.access_token as string;
}

export async function POST(req: NextRequest) {
  const u = new URL(req.url);
  const shopDomain = u.searchParams.get('shopDomain')||'';
  if (!shopDomain) return NextResponse.json({ok:false,error:'Missing shopDomain'},{status:400});

  const token = await getShopToken(shopDomain);
  const since = new Date(Date.now()-30*24*3600*1000).toISOString(); // last 30d
  const url = `https://${shopDomain}/admin/api/2024-07/orders.json?status=any&created_at_min=${encodeURIComponent(since)}&limit=50`;

  const res = await fetch(url, { headers:{'X-Shopify-Access-Token': token, 'Accept':'application/json'}});
  if (!res.ok) {
    const txt = await res.text();
    return NextResponse.json({ok:false,error:`Shopify ${res.status}: ${txt}`}, {status:502});
  }
  const json = await res.json();
  const orders: any[] = json.orders || [];

  // Map a few key fields -> upsert rows (keep simple for now)
  const rows = orders.map(o => ({
    id: String(o.id),
    shop_domain: shopDomain,
    order_number: o.name,
    currency: o.currency,
    created_at_src: o.created_at,
    updated_at_src: o.updated_at,
    subtotal_price: Number(o.subtotal_price || 0),
    total_tax: Number(o.total_tax || 0),
    total_price: Number(o.total_price || 0),
    customer_email: o.email || null,
    shipping_country: o.shipping_address?.country_code || o.customer?.default_address?.country_code || null,
    raw: o,
  }));

  const client = sb();
  const { error } = await client.from('orders').upsert(rows, { onConflict: 'id' });
  if (error) return NextResponse.json({ok:false,error:error.message},{status:500});

  return NextResponse.json({ ok:true, imported: rows.length });
}

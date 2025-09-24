import { NextRequest, NextResponse } from 'next/server';
import { sb } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shopDomain = url.searchParams.get('shopDomain') || '';
  const periodKey  = url.searchParams.get('periodKey')  || '';
  if (!shopDomain || !periodKey) {
    return NextResponse.json({ ok:false, error:'Missing params' }, { status:400 });
  }

  // Adjust to your source (mv_orders_consolidated or v_orders_consolidated)
  const { data, error } = await sb()
    .from('mv_orders_consolidated')
    .select('*')
    .eq('shop_domain', shopDomain);

  if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500 });

  const rows = data || [];
  if (!rows.length) return NextResponse.json({ ok:true, csv:'' });

  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify((r as any)[h] ?? '')).join(','))].join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="vat-${shopDomain}-${periodKey}.csv"`,
    }
  });
}

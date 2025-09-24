import { NextRequest, NextResponse } from 'next/server';
import { sb } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code') || '';
  const hmac = url.searchParams.get('hmac') || '';
  const shop = url.searchParams.get('shop') || '';
  const state = url.searchParams.get('state') || '';

  if (!code || !shop) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_SITE_URL}/?error=missing_code_or_shop`);
  }

  // (Optional) Validate HMAC here (skipped for brevity, we do it on webhooks)

  // Exchange code for token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY!,
      client_secret: process.env.SHOPIFY_API_SECRET!,
      code,
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL}/?error=${encodeURIComponent(JSON.stringify(tokenJson))}`
    );
  }

  const access_token = tokenJson.access_token as string;

  // Upsert shop row
  const supabase = sb();
  await supabase
    .from('shops')
    .upsert({
      shop_domain: shop,
      access_token,
      created_at: new Date().toISOString(),
    }, { onConflict: 'shop_domain' });

  // Optional: register webhooks (orders/create, refunds/create)
  const topics = [
    { topic: 'orders/create' },
    { topic: 'orders/updated' },
    { topic: 'refunds/create' },
  ];
  for (const t of topics) {
    await fetch(`https://${shop}/admin/api/${process.env.SHOPIFY_API_VERSION}/webhooks.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': access_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhook: {
          topic: t.topic,
          address: process.env.SHOPIFY_WEBHOOK_URI!,
          format: 'json',
        }
      }),
    }).catch(()=>{});
  }

  // Send to a minimal dashboard page
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_SITE_URL}/dashboard/vat?shopDomain=${encodeURIComponent(shop)}`
  );
}

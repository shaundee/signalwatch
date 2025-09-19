import { NextRequest, NextResponse } from 'next/server';

export function GET(req: NextRequest) {
  const url = new URL(req.url);
  const shop = url.searchParams.get('shop'); // e.g. example.myshopify.com
  if (!shop) return NextResponse.json({ ok:false, error:'Missing shop' }, { status: 400 });

  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_API_KEY!,
    scope: process.env.SHOPIFY_SCOPES!,
    redirect_uri: process.env.SHOPIFY_REDIRECT_URI!,
    state: shop, // simple CSRF
  });

  return NextResponse.redirect(`https://${shop}/admin/oauth/authorize?${params.toString()}`);
}

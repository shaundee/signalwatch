// ┌───────────────────────────────────────────────────────────┐
// │ File: app/api/hmrc/start/route.ts                         │
// └───────────────────────────────────────────────────────────┘
import { NextRequest, NextResponse } from 'next/server';
import { hmrcAuthUrl } from '@/lib/hmrc/oauth';

export const runtime = 'nodejs';

/**
 * Begins the HMRC OAuth flow: builds the authorize URL, sets a CSRF cookie, and redirects.
 * Expects query ?vrn=123456789&shopDomain=example.myshopify.com
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const vrn = url.searchParams.get('vrn') || '';
  const shopDomain = url.searchParams.get('shopDomain') || '';

  if (!vrn || !shopDomain) {
    return NextResponse.json({ ok: false, error: 'Missing vrn or shopDomain' }, { status: 400 });
  }

  // Encode shopDomain + vrn into state for retrieval in callback
  const state = `${shopDomain}|${vrn}`;
  const authUrl = hmrcAuthUrl({ state });

  const res = NextResponse.redirect(authUrl);
  // Set cookie for CSRF state validation
  res.cookies.set('hmrc_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  });

  return res;
}
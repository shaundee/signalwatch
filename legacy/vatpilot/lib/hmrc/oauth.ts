// ┌───────────────────────────────────────────────────────────┐
// │ File: lib/hmrc/oauth.ts                                   │
// └───────────────────────────────────────────────────────────┘
/**
 * HMRC MTD VAT OAuth helpers (Auth Code flow).
 * Docs: https://developer.service.hmrc.gov.uk/api-documentation/docs/authorisation/user-restricted-endpoints
 */

export type HmrcTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
  token_type: 'Bearer' | string;
  scope: string; // e.g. "read:vat write:vat"
};

export function hmrcHost() {
  const sandbox = (process.env.HMRC_USE_SANDBOX || 'true').toLowerCase() === 'true';
  return sandbox ? 'https://test-api.service.hmrc.gov.uk' : 'https://api.service.hmrc.gov.uk';
}

export function hmrcAuthUrl({ state, scopes }: { state: string; scopes?: string[] }) {
  const client_id = process.env.HMRC_CLIENT_ID!;
  const redirect_uri = process.env.HMRC_REDIRECT_URI!; // must match config exactly
  const scope = (scopes && scopes.length ? scopes : ['read:vat', 'write:vat']).join(' ');

  const url = new URL(hmrcHost() + '/oauth/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('redirect_uri', redirect_uri);
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCodeForToken(code: string): Promise<HmrcTokenResponse> {
  const client_id = process.env.HMRC_CLIENT_ID!;
  const client_secret = process.env.HMRC_CLIENT_SECRET!;
  const redirect_uri = process.env.HMRC_REDIRECT_URI!;

  const body = new URLSearchParams();
  body.set('grant_type', 'authorization_code');
  body.set('client_id', client_id);
  body.set('client_secret', client_secret);
  body.set('redirect_uri', redirect_uri);
  body.set('code', code);

  const res = await fetch(hmrcHost() + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`HMRC token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as HmrcTokenResponse;
}

export async function refreshAccessToken(refresh_token: string): Promise<HmrcTokenResponse> {
  const client_id = process.env.HMRC_CLIENT_ID!;
  const client_secret = process.env.HMRC_CLIENT_SECRET!;

  const body = new URLSearchParams();
  body.set('grant_type', 'refresh_token');
  body.set('client_id', client_id);
  body.set('client_secret', client_secret);
  body.set('refresh_token', refresh_token);

  const res = await fetch(hmrcHost() + '/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`HMRC token refresh failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as HmrcTokenResponse;
}



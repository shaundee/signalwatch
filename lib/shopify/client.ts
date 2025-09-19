export const SHOPIFY_VERSION = process.env.SHOPIFY_API_VERSION || '2024-07';

export function adminUrl(shopDomain: string, path: string) {
  return `https://${shopDomain}/admin/api/${SHOPIFY_VERSION}${path}`;
}

export async function shopifyFetch(
  shopDomain: string,
  accessToken: string,
  path: string,
  init: RequestInit = {}
) {
  const res = await fetch(adminUrl(shopDomain, path), {
    ...init,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${res.status} ${path}: ${text}`);
  }
  return res.json();
}

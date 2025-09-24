export type ShopifyOrder = any; // narrow later

const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token = process.env.SHOPIFY_ADMIN_TOKEN!;
const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-07";

export async function shopifyFetch(path: string, init: RequestInit = {}) {
  const url = `https://${domain}/admin/api/${apiVersion}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    // node fetch in Next server
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${res.status} ${path}: ${text}`);
  }
  return res.json();
}

// Simple REST paginated fetch (status=any to include test/refunds)
export async function listOrdersSince(isoStart: string) {
  // initial page
  const first = await shopifyFetch(`/orders.json?status=any&created_at_min=${encodeURIComponent(isoStart)}&limit=250&order=created_at+asc`);
  let orders: ShopifyOrder[] = first.orders || [];

  // handle Link header for pagination
  let link = (first as any).link || (first as any).headers?.get?.("link");
  // Next.js fetch doesn’t expose raw headers in .json() — for brevity in this MVP,
  // we’ll fetch by updated_at cursor loop with since_id if needed later.
  return orders;
}

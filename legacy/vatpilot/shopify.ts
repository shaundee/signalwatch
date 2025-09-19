import crypto from "crypto";

export function buildInstallUrl(shop: string) {
  const scopes = (process.env.SHOPIFY_SCOPES || "read_orders,read_products,read_customers")
    .split(",").map(s => s.trim()).filter(Boolean).join(",");

  const redirectUri = `${process.env.SHOPIFY_APP_URL}/api/shopify/callback`;
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", process.env.SHOPIFY_API_KEY!);
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  return url.toString();
}

export function verifyAuthHmac(search: URLSearchParams) {
  const hmac = search.get("hmac") || "";
  const message = [...search.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([k,v]) => `${k}=${v}`)
    .join("&");
  const digest = crypto.createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
    .update(message).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmac, "utf8"));
  } catch { return false; }
}

export function verifyWebhook(hmacHeader: string | null, rawBody: string) {
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", process.env.SHOPIFY_API_SECRET!)
    .update(rawBody, "utf8").digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "utf8"), Buffer.from(hmacHeader, "utf8"));
  } catch { return false; }
}

export async function exchangeToken(shop: string, code: string) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code
    })
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; scope: string }>;
}

export async function registerWebhooks(shop: string, accessToken: string, appUrl: string) {
  const topics = ["orders/create", "orders/updated", "refunds/create"];
  for (const topic of topics) {
    const res = await fetch(`https://${shop}/admin/api/2024-07/webhooks.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        webhook: {
          topic,
          address: `${appUrl}/api/shopify/webhooks`,
          format: "json",
        },
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn("Webhook register failed", topic, t);
    }
  }
}


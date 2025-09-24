// ┌───────────────────────────────────────────────────────────┐
// │ lib/shopify/verifyWebhook.ts                        │
// └───────────────────────────────────────────────────────────┘
import crypto from 'crypto';

/**
 * Verify Shopify webhook HMAC signature.
 * @param rawBody raw string body (must NOT be JSON.parsed)
 * @param hmacHeader value from header `x-shopify-hmac-sha256`
 */
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  const digest = crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader || ''));
  } catch {
    return false;
  }
}


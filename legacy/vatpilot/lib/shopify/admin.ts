// ┌───────────────────────────────────────────────────────────┐
// │ File: lib/shopify/admin.ts                                │
// └───────────────────────────────────────────────────────────┘
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-07";

async function gql<T = any>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const res = await fetch(`https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = (json?.errors && json.errors[0]?.message) || `Shopify ${res.status}`;
    throw new Error(msg);
  }
  if (json.errors?.length) throw new Error(json.errors.map((e: any) => e.message).join("; "));
  return json.data as T;
}

export async function getShopId(shopDomain: string, accessToken: string): Promise<string> {
  const data = await gql<{ shop: { id: string } }>(
    shopDomain,
    accessToken,
    `query { shop { id } }`
  );
  return data.shop.id;
}

export async function setShopMetafield(
  shopDomain: string,
  accessToken: string,
  namespace: string,
  key: string,
  value: string
): Promise<void> {
  const ownerId = await getShopId(shopDomain, accessToken);
  const data = await gql<{ metafieldsSet: { userErrors: { field: string[]; message: string }[] } }>(
    shopDomain,
    accessToken,
    `
    mutation SetShopMeta($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      metafields: [
        {
          ownerId,
          namespace,
          key,
          type: "single_line_text_field",
          value,
        },
      ],
    }
  );
  const errs = data.metafieldsSet.userErrors;
  if (errs?.length) throw new Error(errs.map(e => e.message).join("; "));
}

export async function getShopMetafield(
  shopDomain: string,
  accessToken: string,
  namespace: string,
  key: string
): Promise<{ value: string | null }> {
  const data = await gql<{ shop: { metafield: { value: string | null } | null } }>(
    shopDomain,
    accessToken,
    `
    query GetShopMeta($ns: String!, $key: String!) {
      shop { metafield(namespace: $ns, key: $key) { value } }
    }`,
    { ns: namespace, key }

  );
  
  return { value: data.shop.metafield?.value ?? null };
}
export async function addTagsToOrder(
  shopDomain: string,
  accessToken: string,
  orderGid: string,
  tags: string[]
): Promise<void> {
  const data = await gql<{ tagsAdd: { userErrors: { message: string }[] } }>(
    shopDomain,
    accessToken,
    `
    mutation TagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) { userErrors { message } }
    }`,
    { id: orderGid, tags }
  );
  const errs = (data as any).tagsAdd?.userErrors || [];
  if (errs.length) throw new Error(errs.map((e: any) => e.message).join("; "));
}

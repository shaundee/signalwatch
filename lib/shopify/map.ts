

type Order = any;     // keep simple for scaffold
type Refund = any;

export function mapOrder(shopId: string, shopDomain: string, o: Order) {
  return {
    orderRow: {
      id: String(o.id),
      shop_id: shopId as any,
      shop_domain: shopDomain,
      order_number: o.name,
      currency: o.currency,
      created_at_src: o.created_at ? new Date(o.created_at).toISOString() : null,
      updated_at_src: o.updated_at ? new Date(o.updated_at).toISOString() : null,
      subtotal_price: Number(o.current_subtotal_price ?? o.subtotal_price ?? 0),
      total_tax: Number(o.total_tax ?? 0),
      total_price: Number(o.total_price ?? 0),
      customer_email: o.email ?? o.customer?.email ?? null,
      shipping_country: o.shipping_address?.country_code ?? null,
      raw: o,
    },
    lineRows: (o.line_items ?? []).map((li: any) => ({
      id: String(li.id),
      order_id: String(o.id),
      shop_id: shopId as any,
      line_type: 'product',
      sku: li.sku,
      title: li.title,
      quantity: li.quantity ?? 1,
      price: Number(li.price ?? 0),               // unit net (approx)
      total: Number(li.price ?? 0) * (li.quantity ?? 1), // gross-ish
      tax_rate: (li.tax_lines?.[0]?.rate ?? 0) * 100,    // keep as percent-ish if you like
      tax_lines: li.tax_lines ?? [],
      raw: li,
    })),
    shipRow: o.shipping_lines?.[0]
      ? {
          id: `ship_${o.id}`,
          order_id: String(o.id),
          shop_id: shopId as any,
          line_type: 'shipping',
          sku: null,
          title: 'Shipping',
          quantity: 1,
          price: Number(o.shipping_lines[0].price ?? 0),
          total: Number(o.shipping_lines[0].price ?? 0),
          tax_rate: (o.shipping_lines[0].tax_lines?.[0]?.rate ?? 0) * 100,
          tax_lines: o.shipping_lines[0].tax_lines ?? [],
          raw: o.shipping_lines[0],
        }
      : null,
  };
}

export function mapRefund(shopId: string, r: Refund) {
  return {
    id: String(r.id),
    order_id: r.order_id ? String(r.order_id) : null,
    shop_id: shopId as any,
    created_at_src: r.created_at ? new Date(r.created_at).toISOString() : null,
    note: r.note ?? null,
    transactions: r.transactions ?? [],
    refund_line_items: r.refund_line_items ?? [],
    raw: r,
  };
}

'use client';

export default function ShopDomainFilter({ initialValue }: { initialValue: string }) {
  return (
    <input
      name="shopDomain"
      defaultValue={initialValue}
      placeholder="example.myshopify.com"
      className="border rounded-xl px-3 py-2 w-80"
      onChange={(e) => {
        const v = (e.target as HTMLInputElement).value;
        const url = new URL(window.location.href);
        if (v) url.searchParams.set('shopDomain', v);
        else url.searchParams.delete('shopDomain');
        window.location.href = url.toString();
      }}
    />
  );
}

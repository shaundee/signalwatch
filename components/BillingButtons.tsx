"use client";

type UpgradeButtonProps = {
  priceId: string;          // Stripe price_xxx
  accountId: string;
  className?: string;
  children?: React.ReactNode;
};

export function UpgradeButton({ priceId, accountId, className, children }: UpgradeButtonProps) {
  async function go() {
    const r = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priceId, accountId }),
    });
    const j = await r.json();
    if (j?.url) window.location.href = j.url;
  }
  return (
    <button onClick={go} className={className}>
      {children ?? "Upgrade"}
    </button>
  );
}

type ManageBillingButtonProps = {
  customerId?: string | null;
  className?: string;
  children?: React.ReactNode;
};

export function ManageBillingButton({ customerId, className, children }: ManageBillingButtonProps) {
  if (!customerId) return null;
  async function openPortal() {
    const r = await fetch("/api/billing/portal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerId }),
    });
    const j = await r.json();
    if (j?.url) window.location.href = j.url;
  }
  return (
    <button onClick={openPortal} className={className}>
      {children ?? "Manage billing"}
    </button>
  );
}

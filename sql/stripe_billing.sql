-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.stripe_billing (
  id uuid primary key default gen_random_uuid(),
  email text,
  stripe_customer_id text unique not null,
  stripe_subscription_id text,
  status text,
  plan text,
  price_id text,
  current_period_end timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_updated_at on public.stripe_billing;
create trigger trg_set_updated_at
before update on public.stripe_billing
for each row execute procedure public.set_updated_at();

create index if not exists idx_stripe_billing_customer on public.stripe_billing (stripe_customer_id);
create index if not exists idx_stripe_billing_status on public.stripe_billing (status);

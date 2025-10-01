-- accounts + membership
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tier text not null default 'free',              -- 'free' | 'starter' | 'agency'
  soft_limit_scans int not null default 50,
  hard_limit_scans int not null default 100,
  stripe_customer_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.account_users (
  account_id uuid references public.accounts(id) on delete cascade,
  user_id uuid not null,                          -- maps to auth.users.id
  role text not null default 'owner',             -- 'owner' | 'member'
  primary key (account_id, user_id)
);

-- link your existing tables
alter table public.domains add column if not exists account_id uuid references public.accounts(id) on delete cascade;
alter table public.scans   add column if not exists account_id uuid references public.accounts(id) on delete cascade;

-- backfill: put existing rows into a single “default” account (adjust name)
insert into public.accounts (id, name, tier)
  values ('00000000-0000-0000-0000-000000000001', 'Default', 'starter')
on conflict do nothing;

update public.domains set account_id = '00000000-0000-0000-0000-000000000001' where account_id is null;
update public.scans   set account_id = '00000000-0000-0000-0000-000000000001' where account_id is null;

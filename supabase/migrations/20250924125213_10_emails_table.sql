create table if not exists public.emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz not null default now()
);
alter table public.emails enable row level security;

alter table public.domains
  add column if not exists verify_token text,
  add column if not exists verified_at timestamptz;

create index if not exists idx_domains_verified on public.domains (verified_at);

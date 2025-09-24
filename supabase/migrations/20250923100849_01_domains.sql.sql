-- 01_domains.sql
create extension if not exists pgcrypto;

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  last_alert_hash text,
  last_alert_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- universal timestamp trigger function (safe across tables)
create or replace function public.touch_timestamps()
returns trigger
language plpgsql
as $$
begin
  if (to_jsonb(new) ? 'updated_at') then
    new.updated_at := now();
  end if;
  if (tg_op = 'INSERT' and (to_jsonb(new) ? 'created_at') and new.created_at is null) then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_domains_touch on public.domains;
create trigger trg_domains_touch
before update on public.domains
for each row execute function public.touch_timestamps();

-- helpful index (unique already exists on url)
create index if not exists idx_domains_created_at on public.domains (created_at desc);

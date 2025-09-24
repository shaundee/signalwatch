create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 0,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_rate_limits_updated on public.rate_limits;
create trigger trg_rate_limits_updated
before update on public.rate_limits
for each row execute procedure public.set_updated_at();

alter table public.rate_limits enable row level security;
-- Access via service role only.

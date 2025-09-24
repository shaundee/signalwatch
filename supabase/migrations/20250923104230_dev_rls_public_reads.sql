-- Enable RLS
alter table public.domains     enable row level security;
alter table public.scans       enable row level security;
alter table public.scan_checks enable row level security;

-- Optional: allow anon/authenticated roles to select (RLS still applies)
grant usage on schema public to anon, authenticated;
grant select on public.domains, public.scans, public.scan_checks to anon, authenticated;

-- Drop-then-create policies (Postgres has no IF NOT EXISTS here)
drop policy if exists "public read domains" on public.domains;
create policy "public read domains"
  on public.domains
  for select
  using (true);

drop policy if exists "public read scans" on public.scans;
create policy "public read scans"
  on public.scans
  for select
  using (true);

drop policy if exists "public read scan_checks" on public.scan_checks;
create policy "public read scan_checks"
  on public.scan_checks
  for select
  using (true);

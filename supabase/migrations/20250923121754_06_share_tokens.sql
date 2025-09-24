create table if not exists public.report_shares (
  token uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_report_shares_scan on public.report_shares(scan_id);

-- Share-link read policies: allow SELECT if a matching token exists
drop policy if exists "share read scans" on public.scans;
create policy "share read scans"
on public.scans for select
using (
  exists (
    select 1 from public.report_shares rs
    where rs.scan_id = scans.id
  )
);

drop policy if exists "share read scan_checks" on public.scan_checks;
create policy "share read scan_checks"
on public.scan_checks for select
using (
  exists (
    select 1 from public.report_shares rs
    where rs.scan_id = scan_checks.scan_id
  )
);

drop policy if exists "share read domains" on public.domains;
create policy "share read domains"
on public.domains for select
using (
  exists (
    select 1
    from public.scans s
    join public.report_shares rs on rs.scan_id = s.id
    where s.domain_id = domains.id
  )
);

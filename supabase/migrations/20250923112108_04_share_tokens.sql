-- 04_share_tokens.sql
create table if not exists public.report_shares (
  token uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_report_shares_scan on public.report_shares(scan_id);

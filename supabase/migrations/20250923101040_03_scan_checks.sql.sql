-- 03_scan_checks.sql  (safe/idempotent)

create table if not exists public.scan_checks (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  name text not null,
  status text not null,  -- red | amber | green
  details jsonb,
  created_at timestamptz not null default now()
);

-- If the table already existed without created_at, add it now
alter table public.scan_checks
  add column if not exists created_at timestamptz;

-- Backfill nulls so the index has values
update public.scan_checks
set created_at = now()
where created_at is null;

-- Indexes
create index if not exists idx_scan_checks_scan on public.scan_checks (scan_id);
create index if not exists idx_scan_checks_status on public.scan_checks (status);
create index if not exists idx_scan_checks_created_at on public.scan_checks (created_at desc);

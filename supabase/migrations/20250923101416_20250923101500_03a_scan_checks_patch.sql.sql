-- Add missing column(s) safely
alter table public.scan_checks
  add column if not exists created_at timestamptz;

-- Backfill nulls so the index is useful
update public.scan_checks
set created_at = now()
where created_at is null;

-- Ensure FK exists (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'scan_checks_scan_id_fkey'
  ) then
    alter table public.scan_checks
      add constraint scan_checks_scan_id_fkey
      foreign key (scan_id) references public.scans(id)
      on delete cascade;
  end if;
end $$;

-- Recreate helpful indexes (idempotent)
create index if not exists idx_scan_checks_scan on public.scan_checks (scan_id);
create index if not exists idx_scan_checks_status on public.scan_checks (status);
create index if not exists idx_scan_checks_created_at on public.scan_checks (created_at desc);

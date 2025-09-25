-- 1) Create enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'scan_status') then
    create type scan_status as enum ('queued','running','finished','failed');
  end if;
end $$;

-- 2) Ensure column uses enum
alter table public.scans
  alter column status type scan_status
  using status::scan_status;

-- 3) Default + not null (optional but recommended)
alter table public.scans
  alter column status set default 'queued',
  alter column status set not null;

-- 4) Speed up typical queries
create index if not exists idx_scans_status_created_at
  on public.scans (status, created_at desc);

-- 5) (Already added earlier) prevent duplicate active jobs per domain_id
-- create unique index if not exists ux_scans_domain_active
-- on public.scans (domain_id)
-- where status in ('queued','running');

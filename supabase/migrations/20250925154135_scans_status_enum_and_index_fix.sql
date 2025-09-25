-- 0) Drop dependent views (so alter column can proceed)
do $$
declare
  rec record;
begin
  for rec in
    select n.nspname as schema, c.relname as view_name
    from pg_depend d
    join pg_rewrite r on r.oid = d.objid
    join pg_class   c on c.oid = r.ev_class
    join pg_namespace n on n.oid = c.relnamespace
    where d.refobjid = 'public.scans'::regclass
      and c.relkind  = 'v'
  loop
    execute format('drop view if exists %I.%I cascade', rec.schema, rec.view_name);
  end loop;
end $$;

-- 0.1) Drop status-dependent indexes BEFORE the type change
drop index if exists ux_scans_domain_active;
drop index if exists idx_scans_status;
drop index if exists idx_scans_status_created;

-- 1) Create enum if missing
do $$
begin
  if not exists (select 1 from pg_type where typname = 'scan_status') then
    create type scan_status as enum ('queued','running','finished','failed');
  end if;
end $$;

-- 2) Normalize any unexpected values before cast
update public.scans
set status = 'failed'
where status not in ('queued','running','finished','failed');

-- 3) Convert column to enum
alter table public.scans
  alter column status type scan_status
  using status::scan_status;

-- 4) Default + NOT NULL
alter table public.scans
  alter column status set default 'queued',
  alter column status set not null;

-- 5) Recreate enum-aware indexes
create unique index if not exists ux_scans_domain_active
  on public.scans (domain_id)
  where status in ('queued','running');

create index if not exists idx_scans_status
  on public.scans (status);

create index if not exists idx_scans_status_created
  on public.scans (status, created_at desc);

-- 6) Recreate views (simple safe versions; swap for your originals if needed)
create or replace view public.v_scans_queue as
select
  s.id,
  s.domain_id,
  s.created_at,
  s.status,              -- enum
  s.status::text as status_text
from public.scans s
where s.status = 'queued'::scan_status;

create or replace view public.v_scans_counts as
select
  s.status,              -- enum
  s.status::text as status_text,
  count(*)::bigint as count
from public.scans s
group by s.status;

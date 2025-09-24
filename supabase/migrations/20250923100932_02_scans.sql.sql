-- 02_scans.sql
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null,
  status text not null default 'queued',  -- queued | running | finished | failed
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- canonical FK (idempotent)
alter table public.scans
  drop constraint if exists scans_domain_fk;

alter table public.scans
  add constraint scans_domain_fk
  foreign key (domain_id) references public.domains(id)
  on delete cascade;

-- ensure NOT NULL once FK is in place
alter table public.scans
  alter column domain_id set not null;

-- indexes
create index if not exists idx_scans_domain_id on public.scans (domain_id);
create index if not exists idx_scans_status on public.scans (status);
create index if not exists idx_scans_created_at on public.scans (created_at desc);

-- timestamp trigger
drop trigger if exists trg_scans_touch on public.scans;
create trigger trg_scans_touch
before update on public.scans
for each row execute function public.touch_timestamps();

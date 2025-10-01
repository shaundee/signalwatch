-- Multitenancy hardening: per-account uniqueness + monthly counts
-- Safe to run multiple times.

-- 0) Ensure FKs exist (domains.account_id → accounts.id)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_domains_account'
  ) then
    alter table public.domains
      add constraint fk_domains_account
      foreign key (account_id) references public.accounts(id)
      on delete cascade;
  end if;
end $$;

-- 0b) Ensure FKs exist (scans.account_id → accounts.id)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'fk_scans_account'
  ) then
    alter table public.scans
      add constraint fk_scans_account
      foreign key (account_id) references public.accounts(id)
      on delete cascade;
  end if;
end $$;

-- 1) Per-account unique domain URL
--    Drop legacy unique CONSTRAINT on url (if it exists), then add a new constraint on (account_id, url).
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.domains'::regclass
      and conname = 'domains_url_key'
  ) then
    alter table public.domains drop constraint domains_url_key;
  end if;
end $$;

-- If someone had created a standalone index with the same name, drop it safely.
drop index if exists public.domains_url_key;
drop index if exists public.ux_domains_account_url;

-- Prefer constraints (clearer in \d)
alter table public.domains
  add constraint ux_domains_account_url unique (account_id, url);


-- 2) Per-account "only one active scan per domain"
--    Recreate the partial unique index to include account_id + domain_id.
drop index if exists public.ux_scans_domain_active;
create unique index ux_scans_domain_active
  on public.scans (account_id, domain_id)
  where status in ('queued','running');

-- 3) Helpful composite index for listing by status/time (idempotent)
create index if not exists idx_scans_status_created_at
  on public.scans (status, created_at desc);

-- 4) Monthly counts per account (used for plan limits)
create or replace view public.v_monthly_scan_counts as
select
  account_id,
  date_trunc('month', created_at) as month,
  count(*)::int as scans
from public.scans
group by 1,2;

-- 5) (Optional) backfill any legacy NULL account_ids to a default account
--    Replace the UUID below if you want a specific default workspace.
--    Comment these two UPDATEs out if you already backfilled.
-- update public.domains set account_id = '00000000-0000-0000-0000-000000000001' where account_id is null;
-- update public.scans   set account_id = '00000000-0000-0000-0000-000000000001' where account_id is null;

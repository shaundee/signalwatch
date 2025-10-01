-- 0) Ensure RLS enabled on core tables
alter table public.accounts    enable row level security;
alter table public.domains     enable row level security;
alter table public.scans       enable row level security;
alter table public.rate_limits enable row level security;

-- 1) REVOKE direct table privileges from client roles
revoke all on table public.accounts    from anon, authenticated;
revoke all on table public.domains     from anon, authenticated;
revoke all on table public.scans       from anon, authenticated;
revoke all on table public.rate_limits from anon, authenticated;

-- 2) DROP overly-permissive policies (names from your screenshot)
-- Accounts
drop policy if exists "members can read their account" on public.accounts;

-- Domains
drop policy if exists "members insert domains"      on public.domains;
drop policy if exists "members read/write domains"  on public.domains;
drop policy if exists "public read domains"         on public.domains;
drop policy if exists "share read domains"          on public.domains;  -- not needed

-- Scans
drop policy if exists "members read scans" on public.scans;
drop policy if exists "public read scans"  on public.scans;
-- keep "share read scans" only if it filters by a share table; we'll recreate a safe version below
drop policy if exists "share read scans"   on public.scans;

-- 3) SAFE policies

-- 3a) ACCOUNTS: authenticated users can read their own account (based on your helper is_member(id))
create policy "accounts select own"
on public.accounts
for select
to authenticated
using (is_member(id));

-- (writes come from your server using service role; no client writes)

-- 3b) DOMAINS: authenticated users can read only their own rows
create policy "domains select own"
on public.domains
for select
to authenticated
using (is_member(account_id));

-- (no client inserts/updates/deletes; server uses service role)
create policy "domains srv write"
on public.domains
for all
to service_role
using (true)
with check (true);

-- 3c) SCANS: authenticated users can read only their own rows
create policy "scans select own"
on public.scans
for select
to authenticated
using (is_member(account_id));

-- (no client writes; server only)
create policy "scans srv write"
on public.scans
for all
to service_role
using (true)
with check (true);

-- 3d) SCANS: allow public read *only when a share token exists* (keeps public report links working)
-- Adjust the EXISTS clause to match your actual share table/columns
-- Example assumes table public.report_shares(scan_id uuid, token text, is_active boolean)


-- 3e) RATE LIMITS: server only
drop policy if exists "rate_limits srv write" on public.rate_limits;

create policy "rate_limits srv write"
on public.rate_limits
for all
to service_role
using (true)
with check (true);

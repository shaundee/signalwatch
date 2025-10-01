-- enable RLS
alter table public.accounts       enable row level security;
alter table public.account_users  enable row level security;
alter table public.domains        enable row level security;
alter table public.scans          enable row level security;

-- helper: membership check
create or replace function public.is_member(acc uuid)
returns boolean language sql stable as $$
  select exists(
    select 1 from public.account_users au
    where au.account_id = acc and au.user_id = auth.uid()
  );
$$;

-- policies
create policy "members can read their account"
on public.accounts for select using ( public.is_member(id) );

create policy "members read account_users"
on public.account_users for select using ( account_id in (select account_id from public.account_users where user_id = auth.uid()) );

create policy "members read/write domains"
on public.domains for select using ( public.is_member(account_id) );
create policy "members insert domains"
on public.domains for insert with check ( public.is_member(account_id) );
create policy "members read scans"
on public.scans for select using ( public.is_member(account_id) );

-- NOTE: writes to scans are done by the server with service_role, so keep inserts/updates server-only (no public policy).

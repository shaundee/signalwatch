-- 1) Ensure timestamp columns exist on domains
alter table public.domains
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- 2) Drop any legacy triggers that reference set_updated_at
do $$
declare
  t record;
begin
  for t in
    select trigger_name
    from information_schema.triggers
    where event_object_schema = 'public'
      and event_object_table  = 'domains'
      and action_statement ilike '%set_updated_at%'
  loop
    execute format('drop trigger if exists %I on public.domains;', t.trigger_name);
  end loop;
end $$;

-- Also drop the old function if it exists
drop function if exists public.set_updated_at() cascade;

-- 3) Safe, reusable timestamp trigger
create or replace function public.touch_timestamps()
returns trigger
language plpgsql
as $$
begin
  if (to_jsonb(new) ? 'updated_at') then
    new.updated_at := now();
  end if;
  if (tg_op = 'INSERT' and (to_jsonb(new) ? 'created_at') and new.created_at is null) then
    new.created_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_domains_touch on public.domains;
create trigger trg_domains_touch
before update on public.domains
for each row execute function public.touch_timestamps();

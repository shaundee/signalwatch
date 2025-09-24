-- Ensure backing table exists
create table if not exists public.request_counters (
  route        text        not null,
  ip           text        not null,
  window_start timestamptz not null,
  count        int         not null default 0,
  primary key (route, ip, window_start)
);

create index if not exists idx_request_counters_gc
  on public.request_counters (window_start);

-- (Re)create increment function
create or replace function public.fn_increment_counter(
  p_route text,
  p_ip text,
  p_window_start timestamptz
) returns int
language plpgsql
as $$
declare
  new_count int;
begin
  insert into public.request_counters(route, ip, window_start, count)
  values (p_route, p_ip, p_window_start, 1)
  on conflict (route, ip, window_start)
  do update set count = public.request_counters.count + 1
  returning count into new_count;

  return new_count;
end $$;

create table if not exists public.request_counters (
  route text not null,
  ip text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (route, ip, window_start)
);

create index if not exists idx_request_counters_gc on public.request_counters (window_start);

-- Simple 60s window—clean old rows after 24h via cron/maintenance later

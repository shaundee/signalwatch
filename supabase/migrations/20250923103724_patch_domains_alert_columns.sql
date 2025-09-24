alter table public.domains
  add column if not exists last_alert_hash text,
  add column if not exists last_alert_at timestamptz;

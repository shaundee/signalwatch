-- supabase/migrations/<ts>_alerts_meta.sql
alter table public.domains
  add column if not exists last_alert_hash text,
  add column if not exists last_alert_at timestamptz;

-- helper for quick hash (optional if you prefer JSON.stringify client-side)
create extension if not exists pgcrypto;

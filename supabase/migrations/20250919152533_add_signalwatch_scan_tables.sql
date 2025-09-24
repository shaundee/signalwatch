-- SignalWatch core tables (safe to re-run)
create extension if not exists pgcrypto;

create table if not exists public.domains (
  id uuid primary key default gen_random_uuid(),
  url text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references public.domains(id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.scan_checks (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  name text not null,
  status text not null,
  details jsonb
);

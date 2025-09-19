-- Projects (sites/apps to monitor)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  base_url text not null,
  sgtm_url text,
  region text default 'EU',
  created_at timestamptz default now()
);

-- Third-party connections (GA4, META, SLACK, CMP)
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  provider text not null check (provider in ('GA4','META','SLACK','CMP')),
  encrypted_token bytea,
  meta_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Checks to run on a schedule
create table if not exists public.checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null check (kind in ('purchase_browser','purchase_server','consent_v2','sgtm_health','container_diff')),
  schedule_cron text not null,
  config_json jsonb default '{}'::jsonb,
  is_enabled boolean default true,
  created_at timestamptz default now()
);

-- Executions
create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  check_id uuid references public.checks(id) on delete cascade,
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text check (status in ('pass','fail','error')),
  summary text,
  logs_json jsonb default '{}'::jsonb
);

-- Alerts
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,
  severity text check (severity in ('p1','p2','info')) default 'p1',
  message text not null,
  sent_to text,
  created_at timestamptz default now()
);

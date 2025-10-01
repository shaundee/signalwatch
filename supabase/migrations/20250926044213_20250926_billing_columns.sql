-- accounts must have these columns for billing & limits
alter table public.accounts
  add column if not exists stripe_customer_id text,
  add column if not exists tier text not null default 'free',            -- 'free' | 'starter' | 'agency'
  add column if not exists soft_limit_scans int not null default 50,
  add column if not exists hard_limit_scans int not null default 100,
  add column if not exists slack_webhook_url text;

-- quick tier -> limits map (helper view for debugging)
create or replace view public.v_account_limits as
select id, name, tier, soft_limit_scans, hard_limit_scans from public.accounts;

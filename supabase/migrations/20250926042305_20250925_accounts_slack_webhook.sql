alter table public.accounts
  add column if not exists slack_webhook_url text;

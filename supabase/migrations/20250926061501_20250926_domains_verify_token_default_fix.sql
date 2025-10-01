-- Make sure columns exist (no-op if already there)
alter table public.domains
  add column if not exists verify_token text,
  add column if not exists verified_at timestamptz;

-- 1) Set a default for NEW rows
do $$
begin
  -- Primary: pgcrypto via extensions schema
  alter table public.domains
    alter column verify_token
    set default encode(extensions.gen_random_bytes(16), 'hex');
exception
  when undefined_function then
    -- Fallback: md5 of a random uuid (still 32 hex chars)
    alter table public.domains
      alter column verify_token
      set default md5(gen_random_uuid()::text);
end $$;

-- 2) Backfill any existing NULL tokens
do $$
begin
  update public.domains
     set verify_token = encode(extensions.gen_random_bytes(16), 'hex')
   where verify_token is null;
exception
  when undefined_function then
    update public.domains
       set verify_token = md5(gen_random_uuid()::text)
     where verify_token is null;
end $$;

-- 3) Helpful index (no-op if exists)
create index if not exists idx_domains_verified on public.domains (verified_at);

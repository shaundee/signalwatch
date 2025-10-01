-- Ensure columns exist (no-ops if already there)
alter table public.domains
  add column if not exists verify_token text,
  add column if not exists verified_at timestamptz;

-- Set a default for NEW rows (schema-safe + fallback)
do $$
begin
  alter table public.domains
    alter column verify_token
    set default encode(extensions.gen_random_bytes(16), 'hex');
exception
  when undefined_function then
    alter table public.domains
      alter column verify_token
      set default md5(gen_random_uuid()::text);
end $$;

-- Backfill existing NULLs (schema-safe + fallback)
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

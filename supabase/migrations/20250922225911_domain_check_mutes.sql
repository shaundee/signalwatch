create table if not exists public.domain_check_mutes (
  domain_id uuid references public.domains(id) on delete cascade,
  check_name text not null,
  primary key (domain_id, check_name)
);

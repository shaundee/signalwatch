-- helpful index first
create index if not exists idx_scans_domain_id on public.scans(domain_id);

-- add the FK (will fail if any orphan still exists)
alter table public.scans
  add constraint scans_domain_fk
  foreign key (domain_id) references public.domains(id)
  on delete cascade;

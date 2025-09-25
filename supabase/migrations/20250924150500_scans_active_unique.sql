-- prevents more than one active scan per domain_id
create unique index if not exists ux_scans_domain_active
on public.scans (domain_id)
where status in ('queued','running');

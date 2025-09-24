-- Clean up legacy queued scans whose domain no longer exists
with doomed as (
  select s.id
  from public.scans s
  left join public.domains d on d.id = s.domain_id
  where s.status = 'queued' and d.id is null
)
delete from public.scans s
using doomed
where s.id = doomed.id;

-- Nice-to-have: speed up queue selection for process-all
create index if not exists idx_scans_status_created
  on public.scans(status, created_at);

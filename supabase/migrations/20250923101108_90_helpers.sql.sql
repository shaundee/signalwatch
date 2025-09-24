-- 90_helpers.sql

-- recent queue view
create or replace view public.v_scans_queue as
select s.id as scan_id, s.domain_id, d.url, s.status, s.created_at
from public.scans s
join public.domains d on d.id = s.domain_id
where s.status = 'queued'
order by s.created_at asc;

-- quick counts
create or replace view public.v_scans_counts as
select status, count(*) as c
from public.scans
group by status
order by status;

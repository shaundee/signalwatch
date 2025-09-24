-- 99_sanity.sql

-- Remove queued scans that reference no domain (should be 0 after FK)
delete from public.scans s
where s.status = 'queued'
  and not exists (select 1 from public.domains d where d.id = s.domain_id);

-- Inspect top rows
-- select * from public.v_scans_queue limit 20;
-- select * from public.v_scans_counts;

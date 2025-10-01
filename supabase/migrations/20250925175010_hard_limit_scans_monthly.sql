create or replace view v_monthly_scan_counts as
select account_id, date_trunc('month', created_at) as month, count(*)::int as scans
from public.scans group by 1,2;

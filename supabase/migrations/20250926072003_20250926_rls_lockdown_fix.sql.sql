-- Remove the public-share policy we just tried to add (if it exists)
drop policy if exists "scans share read" on public.scans;

-- (No public read at table level for now)
-- Reports remain accessible via your Next.js route that uses the service role.

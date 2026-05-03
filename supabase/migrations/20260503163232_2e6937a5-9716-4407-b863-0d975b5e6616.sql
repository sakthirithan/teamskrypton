
-- Allow all authenticated users to view PS entries and individual targets for leaderboard parity
DROP POLICY IF EXISTS "Team members can read all PS entries (read-only)" ON public.ps_daily_entries;
DROP POLICY IF EXISTS "View PS entries based on role" ON public.ps_daily_entries;
CREATE POLICY "All authenticated can view PS entries"
ON public.ps_daily_entries FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can view relevant targets" ON public.grouping_targets;
CREATE POLICY "All authenticated can view targets"
ON public.grouping_targets FOR SELECT
USING (auth.uid() IS NOT NULL);

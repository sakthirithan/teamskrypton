-- Fix RLS policies to allow all authenticated users to view leaderboard data

-- 1. ps_daily_entries
ALTER TABLE public.ps_daily_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View PS entries based on role" ON public.ps_daily_entries;
DROP POLICY IF EXISTS "Everyone can view PS entries" ON public.ps_daily_entries;
CREATE POLICY "Everyone can view PS entries"
ON public.ps_daily_entries
FOR SELECT
TO authenticated
USING (true);

-- 2. grouping_targets
ALTER TABLE public.grouping_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view relevant targets" ON public.grouping_targets;
DROP POLICY IF EXISTS "Everyone can view targets" ON public.grouping_targets;
CREATE POLICY "Everyone can view targets"
ON public.grouping_targets
FOR SELECT
TO authenticated
USING (true);

-- 3. activity_points
ALTER TABLE public.activity_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View activity points" ON public.activity_points;
DROP POLICY IF EXISTS "Everyone can view activity points" ON public.activity_points;
CREATE POLICY "Everyone can view activity points"
ON public.activity_points
FOR SELECT
TO authenticated
USING (true);

-- 4. user_points (Golden Points)
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view golden points" ON public.user_points;
CREATE POLICY "Everyone can view golden points"
ON public.user_points
FOR SELECT
TO authenticated
USING (true);

-- 5. skill_levels
ALTER TABLE public.skill_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view skill levels" ON public.skill_levels;
CREATE POLICY "Everyone can view skill levels"
ON public.skill_levels
FOR SELECT
TO authenticated
USING (true);

-- 6. skill_challenge_completions
ALTER TABLE public.skill_challenge_completions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone can view challenge completions" ON public.skill_challenge_completions;
CREATE POLICY "Everyone can view challenge completions"
ON public.skill_challenge_completions
FOR SELECT
TO authenticated
USING (true);

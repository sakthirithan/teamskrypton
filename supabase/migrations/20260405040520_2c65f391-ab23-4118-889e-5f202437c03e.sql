-- Fix: Allow leadership to insert skill_levels for other users (for XP approval)
DROP POLICY IF EXISTS "Upsert own skill levels" ON public.skill_levels;
CREATE POLICY "Upsert skill levels" ON public.skill_levels
  FOR INSERT TO public
  WITH CHECK ((auth.uid() = user_id) OR is_leadership(auth.uid()));
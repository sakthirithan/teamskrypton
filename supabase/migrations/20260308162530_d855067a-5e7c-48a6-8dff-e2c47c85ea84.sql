
-- Allow users to delete their own skills (not just leadership)
DROP POLICY IF EXISTS "Leadership can delete member skills" ON public.member_skills;
CREATE POLICY "Users can delete own skills or leadership can delete any"
ON public.member_skills FOR DELETE
TO authenticated
USING (
  (auth.uid() = user_id)
  OR is_leadership(auth.uid())
);

-- Allow users to update their own skills (not just leadership)
DROP POLICY IF EXISTS "Leadership can update member skills" ON public.member_skills;
CREATE POLICY "Users can update own skills or leadership can update any"
ON public.member_skills FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id)
  OR is_leadership(auth.uid())
);

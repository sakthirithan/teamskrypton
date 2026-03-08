
-- Revert: only leadership can delete/update member skills
DROP POLICY IF EXISTS "Users can delete own skills or leadership can delete any" ON public.member_skills;
CREATE POLICY "Leadership can delete member skills"
ON public.member_skills FOR DELETE
TO authenticated
USING (is_leadership(auth.uid()));

DROP POLICY IF EXISTS "Users can update own skills or leadership can update any" ON public.member_skills;
CREATE POLICY "Leadership can update member skills"
ON public.member_skills FOR UPDATE
TO authenticated
USING (is_leadership(auth.uid()));

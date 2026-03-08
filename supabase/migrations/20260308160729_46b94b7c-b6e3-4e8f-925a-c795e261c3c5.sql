
-- Update INSERT policy: allow users to create their own skills OR leadership can create for anyone
DROP POLICY IF EXISTS "Leadership can assign member skills" ON public.member_skills;
CREATE POLICY "Users and leadership can assign member skills"
ON public.member_skills
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id AND auth.uid() = assigned_by)
  OR is_leadership(auth.uid())
);

-- DELETE remains leadership-only (already correct, no change needed)

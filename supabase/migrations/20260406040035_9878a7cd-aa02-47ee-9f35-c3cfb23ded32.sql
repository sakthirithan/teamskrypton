
-- Drop leadership-only insert policy on activity_points
DROP POLICY IF EXISTS "Leadership manages activity points" ON public.activity_points;
-- Allow any authenticated user to insert activity points
CREATE POLICY "Any user manages activity points"
ON public.activity_points
FOR INSERT
TO public
WITH CHECK (auth.uid() IS NOT NULL);

-- Drop leadership-only update policy
DROP POLICY IF EXISTS "Leadership updates activity points" ON public.activity_points;
-- Allow any authenticated user to update activity points
CREATE POLICY "Any user updates activity points"
ON public.activity_points
FOR UPDATE
TO public
USING (auth.uid() IS NOT NULL);

-- Drop leadership-only delete policy
DROP POLICY IF EXISTS "Leadership deletes activity points" ON public.activity_points;
-- Allow any authenticated user to delete their own or leadership to delete any
CREATE POLICY "Any user deletes activity points"
ON public.activity_points
FOR DELETE
TO public
USING (auth.uid() IS NOT NULL);

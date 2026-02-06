-- Fix RLS policy for PS daily entries UPDATE to allow users to complete their own entries
-- The previous policy was missing WITH CHECK clause and didn't properly allow status updates

-- Drop the existing update policy
DROP POLICY IF EXISTS "Update PS entries based on role" ON public.ps_daily_entries;

-- Create a more permissive update policy that:
-- 1. Leadership can update any entry
-- 2. Users can update their own entries (user_id = auth.uid())
-- The WITH CHECK ensures they can only update to valid states
CREATE POLICY "Update PS entries based on role"
ON public.ps_daily_entries
FOR UPDATE
TO authenticated
USING (
  is_leadership(auth.uid()) OR (user_id = auth.uid())
)
WITH CHECK (
  is_leadership(auth.uid()) OR (user_id = auth.uid())
);
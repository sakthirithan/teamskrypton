-- Update RLS policies for grouping_targets to allow TM and Strategist to manage targets
-- DROP existing restrictive policies first
DROP POLICY IF EXISTS "TL/VC can create targets" ON public.grouping_targets;
DROP POLICY IF EXISTS "TL/VC can delete targets" ON public.grouping_targets;
DROP POLICY IF EXISTS "Update targets based on role" ON public.grouping_targets;

-- Create new policies that allow TL, VC, TM, and Strategist to manage targets
-- INSERT: Leadership roles can create targets
CREATE POLICY "Leadership can create targets" 
ON public.grouping_targets 
FOR INSERT 
WITH CHECK (is_leadership(auth.uid()));

-- UPDATE: Leadership can update any target, OR user can update their own editable target
CREATE POLICY "Leadership can update targets" 
ON public.grouping_targets 
FOR UPDATE 
USING (
  is_leadership(auth.uid()) 
  OR ((user_id = auth.uid()) AND (editable = true))
);

-- DELETE: Leadership roles can delete targets
CREATE POLICY "Leadership can delete targets" 
ON public.grouping_targets 
FOR DELETE 
USING (is_leadership(auth.uid()));
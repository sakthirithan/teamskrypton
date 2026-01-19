-- Drop the existing insert policy and create a new one that allows team members
DROP POLICY IF EXISTS "Leadership can create tasks" ON public.tasks;

-- Create new policy: Leadership can create any tasks, team members can only create for themselves
CREATE POLICY "Authenticated users can create tasks"
ON public.tasks
FOR INSERT
WITH CHECK (
  -- Leadership can assign to anyone
  is_leadership(auth.uid()) 
  OR 
  -- Team members can only create tasks assigned to themselves
  (auth.uid() = assigned_to AND auth.uid() = assigned_by)
);
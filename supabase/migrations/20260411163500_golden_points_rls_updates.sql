-- Function to check if user is a lead for another user in any PBL project
CREATE OR REPLACE FUNCTION public.is_lead_for_user(_lead_user_id UUID, _target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members p1
    JOIN public.project_members p2 ON p1.project_id = p2.project_id
    WHERE p1.user_id = _lead_user_id
      AND (p1.role = 'lead' OR p1.role = 'manager')
      AND p2.user_id = _target_user_id
  )
$$;

-- Golden Points (user_points) RLS 
DROP POLICY IF EXISTS "Insert points" ON public.user_points;
DROP POLICY IF EXISTS "Update points" ON public.user_points;
DROP POLICY IF EXISTS "Delete points" ON public.user_points;

CREATE POLICY "Insert points" ON public.user_points
FOR INSERT
WITH CHECK (is_leadership(auth.uid()) OR is_lead_for_user(auth.uid(), user_id));

CREATE POLICY "Update points" ON public.user_points
FOR UPDATE
USING (is_leadership(auth.uid()) OR is_lead_for_user(auth.uid(), user_id));

CREATE POLICY "Delete points" ON public.user_points
FOR DELETE
USING (is_leadership(auth.uid()) OR is_lead_for_user(auth.uid(), user_id));

-- Points History RLS
-- Let's make sure it has appropriate policies.
DROP POLICY IF EXISTS "Insert points_history" ON public.points_history;
CREATE POLICY "Insert points_history" ON public.points_history
FOR INSERT
WITH CHECK (is_leadership(auth.uid()) OR is_lead_for_user(auth.uid(), user_id));

-- Grouping Notifications RLS: Allow anyone to insert and send a message to anyone
DROP POLICY IF EXISTS "Authenticated users send notifications" ON public.grouping_notifications;
CREATE POLICY "Authenticated users send notifications" ON public.grouping_notifications
FOR INSERT TO public
WITH CHECK (auth.uid() IS NOT NULL);

-- Project Notifications RLS: Allow anyone to insert
DROP POLICY IF EXISTS "Create notifications" ON public.project_notifications;
CREATE POLICY "Create notifications" ON public.project_notifications
FOR INSERT TO public
WITH CHECK (auth.uid() IS NOT NULL);

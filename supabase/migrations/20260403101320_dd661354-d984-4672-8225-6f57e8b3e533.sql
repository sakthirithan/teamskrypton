
-- Allow all authenticated users to send notifications (not just leadership)
DROP POLICY IF EXISTS "Leadership sends notifications" ON public.grouping_notifications;
CREATE POLICY "Authenticated users send notifications" ON public.grouping_notifications
  FOR INSERT TO public
  WITH CHECK (auth.uid() = sender_id);

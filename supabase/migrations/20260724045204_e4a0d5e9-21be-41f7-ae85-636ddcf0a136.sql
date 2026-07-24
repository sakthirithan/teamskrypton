-- Clean up overlapping RLS policies on grouping_notifications and add polls.anonymous
DROP POLICY IF EXISTS "DEBUG insert" ON public.grouping_notifications;
DROP POLICY IF EXISTS "Insert notifications" ON public.grouping_notifications;
DROP POLICY IF EXISTS "allow sending notifications" ON public.grouping_notifications;
DROP POLICY IF EXISTS "Authenticated users send notifications" ON public.grouping_notifications;

CREATE POLICY "Any authenticated user can send notifications"
ON public.grouping_notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND recipient_id IS NOT NULL);

-- Ensure sender_id is auto-populated so client never has to set it
DROP TRIGGER IF EXISTS set_notification_sender ON public.grouping_notifications;
CREATE TRIGGER set_notification_sender
BEFORE INSERT ON public.grouping_notifications
FOR EACH ROW EXECUTE FUNCTION public.set_sender_id();

-- Anonymous voting flag for polls
ALTER TABLE public.polls ADD COLUMN IF NOT EXISTS anonymous BOOLEAN NOT NULL DEFAULT false;
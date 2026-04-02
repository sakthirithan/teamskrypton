
-- Grouping notifications table for leads to send notifications/alerts to individuals
CREATE TABLE public.grouping_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grouping_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leadership sends notifications" ON public.grouping_notifications
  FOR INSERT TO public WITH CHECK (is_leadership(auth.uid()));

CREATE POLICY "View own notifications" ON public.grouping_notifications
  FOR SELECT TO public USING (recipient_id = auth.uid() OR is_leadership(auth.uid()));

CREATE POLICY "Update own notifications" ON public.grouping_notifications
  FOR UPDATE TO public USING (recipient_id = auth.uid());

CREATE POLICY "Delete notifications" ON public.grouping_notifications
  FOR DELETE TO public USING (is_leadership(auth.uid()) OR recipient_id = auth.uid());

-- Add balance_points to grouping_targets for individuals' starting balance
ALTER TABLE public.grouping_targets ADD COLUMN balance_points integer NOT NULL DEFAULT 0;

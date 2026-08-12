-- Announcement & Broadcast System RLS Security & Performance Migration

-- 1. Ensure type column handles 'broadcast' values
ALTER TABLE public.messenger_messages
  ADD COLUMN IF NOT EXISTS group_id text DEFAULT NULL;

ALTER TABLE public.grouping_notifications
  ADD COLUMN IF NOT EXISTS is_broadcast boolean DEFAULT false;

-- 2. RLS Policies for messenger_messages Broadcast Access
DROP POLICY IF EXISTS "Users view own or broadcast messages" ON public.messenger_messages;
CREATE POLICY "Users view own or broadcast messages"
  ON public.messenger_messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (metadata->'group_members') ? auth.uid()::text
    OR type = 'broadcast'
    OR group_id = 'announcement'
  );

DROP POLICY IF EXISTS "Authorized users send messages" ON public.messenger_messages;
CREATE POLICY "Authorized users send messages"
  ON public.messenger_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    OR (
      (type = 'broadcast' OR group_id = 'announcement')
      AND (
        EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid()
          AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
        )
      )
    )
  );

-- 3. RLS Policies for grouping_notifications Broadcast Access
DROP POLICY IF EXISTS "View own or broadcast notifications" ON public.grouping_notifications;
CREATE POLICY "View own or broadcast notifications"
  ON public.grouping_notifications FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR sender_id = auth.uid()
    OR is_broadcast = true
    OR type = 'broadcast'
  );

-- 4. Index for broadcast message retrieval
CREATE INDEX IF NOT EXISTS idx_messenger_messages_type_created
  ON public.messenger_messages(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messenger_messages_group_id_created
  ON public.messenger_messages(group_id, created_at DESC);

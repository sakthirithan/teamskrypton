-- ============================================================
-- Create Dedicated Messenger Tables
-- Decouples Messenger Direct Messages, Group Chats, and Polls
-- from legacy grouping_notifications table.
-- ============================================================

-- 1. Messenger Conversations Table
CREATE TABLE IF NOT EXISTS public.messenger_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct',
  title text DEFAULT NULL,
  avatar_url text DEFAULT NULL,
  creator_id uuid NOT NULL DEFAULT auth.uid(),
  last_message text DEFAULT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Messenger Messages Table
CREATE TABLE IF NOT EXISTS public.messenger_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  recipient_id uuid DEFAULT NULL,
  title text DEFAULT NULL,
  message text,
  type text NOT NULL DEFAULT 'direct',
  is_read boolean NOT NULL DEFAULT false,
  expires_at timestamptz DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.messenger_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_messages ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for Messenger Conversations
DROP POLICY IF EXISTS "Users view own conversations" ON public.messenger_conversations;
CREATE POLICY "Users view own conversations" ON public.messenger_conversations
  FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR (metadata->'members') ? auth.uid()::text
  );

DROP POLICY IF EXISTS "Users create conversations" ON public.messenger_conversations;
CREATE POLICY "Users create conversations" ON public.messenger_conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users update own conversations" ON public.messenger_conversations;
CREATE POLICY "Users update own conversations" ON public.messenger_conversations
  FOR UPDATE TO authenticated
  USING (
    creator_id = auth.uid()
    OR (metadata->'members') ? auth.uid()::text
  );

-- 5. RLS Policies for Messenger Messages
DROP POLICY IF EXISTS "Users view own messages" ON public.messenger_messages;
CREATE POLICY "Users view own messages" ON public.messenger_messages
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (metadata->'group_members') ? auth.uid()::text
  );

DROP POLICY IF EXISTS "Users send messages" ON public.messenger_messages;
CREATE POLICY "Users send messages" ON public.messenger_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users update own messages" ON public.messenger_messages;
CREATE POLICY "Users update own messages" ON public.messenger_messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users delete own messages" ON public.messenger_messages;
CREATE POLICY "Users delete own messages" ON public.messenger_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- 6. Indices for fast querying
CREATE INDEX IF NOT EXISTS idx_messenger_messages_recipient_created
  ON public.messenger_messages(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messenger_messages_sender_created
  ON public.messenger_messages(sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messenger_messages_conversation
  ON public.messenger_messages(conversation_id, created_at DESC);

-- 7. Add to Supabase Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_conversations;

-- 8. Ensure grouping_notifications schema compatibility for legacy compatibility
ALTER TABLE public.grouping_notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

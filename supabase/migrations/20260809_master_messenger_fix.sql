-- ================================================================
-- TEAMS KRYPTON — MASTER MESSENGER + POLLS MIGRATION
-- Idempotent — safe to run multiple times
-- Apply in: Supabase Dashboard → SQL Editor
-- Project: kqguwponnyjhbgylpdss
-- ================================================================

-- ================================================================
-- PART 1: Patch grouping_notifications with missing columns
-- ================================================================
ALTER TABLE public.grouping_notifications
  ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sender_id_text TEXT;

-- Fix INSERT policy: allow any authenticated user (not just leadership)
DROP POLICY IF EXISTS "Leadership sends notifications" ON public.grouping_notifications;
DROP POLICY IF EXISTS "Authenticated users send notifications" ON public.grouping_notifications;
DROP POLICY IF EXISTS "Any authenticated user can send notifications" ON public.grouping_notifications;
CREATE POLICY "Any authenticated user can send notifications"
  ON public.grouping_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND recipient_id IS NOT NULL);

-- Fix SELECT: sender + recipient + leadership
DROP POLICY IF EXISTS "View own notifications" ON public.grouping_notifications;
CREATE POLICY "View own notifications"
  ON public.grouping_notifications
  FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR sender_id = auth.uid()
    OR is_leadership(auth.uid())
  );

-- Fix UPDATE: sender + recipient
DROP POLICY IF EXISTS "Update own notifications" ON public.grouping_notifications;
CREATE POLICY "Update own notifications"
  ON public.grouping_notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() OR sender_id = auth.uid());

-- Fix DELETE: sender + recipient + leadership
DROP POLICY IF EXISTS "Delete notifications" ON public.grouping_notifications;
CREATE POLICY "Delete notifications"
  ON public.grouping_notifications
  FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR is_leadership(auth.uid())
  );

-- Indices
CREATE INDEX IF NOT EXISTS idx_gn_recipient_created
  ON public.grouping_notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gn_sender_created
  ON public.grouping_notifications(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gn_expires
  ON public.grouping_notifications(expires_at)
  WHERE expires_at IS NOT NULL;

-- Add to realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='grouping_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grouping_notifications;
  END IF;
END $$;


-- ================================================================
-- PART 2: Messenger Conversations Table
-- ================================================================
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

ALTER TABLE public.messenger_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own conversations" ON public.messenger_conversations;
CREATE POLICY "Users view own conversations"
  ON public.messenger_conversations FOR SELECT TO authenticated
  USING (
    creator_id = auth.uid()
    OR (metadata->'members') ? auth.uid()::text
  );

DROP POLICY IF EXISTS "Users create conversations" ON public.messenger_conversations;
CREATE POLICY "Users create conversations"
  ON public.messenger_conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users update own conversations" ON public.messenger_conversations;
CREATE POLICY "Users update own conversations"
  ON public.messenger_conversations FOR UPDATE TO authenticated
  USING (
    creator_id = auth.uid()
    OR (metadata->'members') ? auth.uid()::text
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='messenger_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_conversations;
  END IF;
END $$;


-- ================================================================
-- PART 3: Messenger Messages Table
-- ================================================================
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

ALTER TABLE public.messenger_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.messenger_messages TO authenticated;
GRANT ALL ON public.messenger_messages TO service_role;

DROP POLICY IF EXISTS "Users view own messages" ON public.messenger_messages;
CREATE POLICY "Users view own messages"
  ON public.messenger_messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (metadata->'group_members') ? auth.uid()::text
  );

DROP POLICY IF EXISTS "Users send messages" ON public.messenger_messages;
CREATE POLICY "Users send messages"
  ON public.messenger_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users update own messages" ON public.messenger_messages;
CREATE POLICY "Users update own messages"
  ON public.messenger_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own messages" ON public.messenger_messages;
CREATE POLICY "Users delete own messages"
  ON public.messenger_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_mm_recipient_created
  ON public.messenger_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mm_sender_created
  ON public.messenger_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mm_conversation
  ON public.messenger_messages(conversation_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='messenger_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_messages;
  END IF;
END $$;


-- ================================================================
-- PART 4: Polls, Poll Options, Poll Votes
-- ================================================================

-- POLLS
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'grouping' CHECK (mode IN ('grouping', 'pbl', 'messenger')),
  conversation_id UUID REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  session_id UUID,
  project_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  anonymous BOOLEAN NOT NULL DEFAULT false,
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  results_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "polls_select_all" ON public.polls;
CREATE POLICY "polls_select_all" ON public.polls FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "polls_insert_own" ON public.polls;
CREATE POLICY "polls_insert_own" ON public.polls FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "polls_update_creator" ON public.polls;
CREATE POLICY "polls_update_creator" ON public.polls FOR UPDATE TO authenticated
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "polls_delete_creator" ON public.polls;
CREATE POLICY "polls_delete_creator" ON public.polls FOR DELETE TO authenticated
  USING (auth.uid() = creator_id);

-- POLL OPTIONS
CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT ALL ON public.poll_options TO service_role;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poll_options_select_all" ON public.poll_options;
CREATE POLICY "poll_options_select_all" ON public.poll_options FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "poll_options_write_creator" ON public.poll_options;
CREATE POLICY "poll_options_write_creator" ON public.poll_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.creator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.creator_id = auth.uid()));

-- POLL VOTES
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, voter_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "poll_votes_select_all" ON public.poll_votes;
CREATE POLICY "poll_votes_select_all" ON public.poll_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "poll_votes_insert_own" ON public.poll_votes;
CREATE POLICY "poll_votes_insert_own" ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = voter_id);

DROP POLICY IF EXISTS "poll_votes_delete_own" ON public.poll_votes;
CREATE POLICY "poll_votes_delete_own" ON public.poll_votes FOR DELETE TO authenticated
  USING (auth.uid() = voter_id);

-- Update voter's vote (for single-choice polls, allow changing vote)
DROP POLICY IF EXISTS "poll_votes_update_own" ON public.poll_votes;
CREATE POLICY "poll_votes_update_own" ON public.poll_votes FOR UPDATE TO authenticated
  USING (auth.uid() = voter_id);

-- Realtime for polls
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='polls') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='poll_options') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_options;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='poll_votes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
  END IF;
END $$;

-- ================================================================
-- PART 5: update_updated_at trigger for polls
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'polls_updated'
  ) THEN
    CREATE TRIGGER polls_updated
      BEFORE UPDATE ON public.polls
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ================================================================
-- END OF MIGRATION
-- ================================================================

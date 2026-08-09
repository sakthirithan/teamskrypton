-- ================================================================
-- TEAMS KRYPTON — GROUP MESSAGE MODEL REFACTOR + SOFT DELETE
-- Idempotent — safe to run multiple times
-- Apply in: Supabase Dashboard → SQL Editor
-- ================================================================

-- ================================================================
-- PART 1: Upgrade messenger_messages for single-row group model
-- ================================================================

-- Add group_id column (top-level, not buried in metadata)
ALTER TABLE public.messenger_messages
  ADD COLUMN IF NOT EXISTS group_id UUID DEFAULT NULL;

-- Add group_members as a proper UUID array column
ALTER TABLE public.messenger_messages
  ADD COLUMN IF NOT EXISTS group_members UUID[] DEFAULT NULL;

-- Index for fast group message queries
CREATE INDEX IF NOT EXISTS idx_mm_group_id
  ON public.messenger_messages(group_id, created_at DESC)
  WHERE group_id IS NOT NULL;

-- ================================================================
-- PART 2: Update RLS on messenger_messages
--   SELECT: sender | recipient (DM) | group member (group)
-- ================================================================

DROP POLICY IF EXISTS "Users view own messages" ON public.messenger_messages;
CREATE POLICY "Users view own messages"
  ON public.messenger_messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR (
      group_id IS NOT NULL
      AND group_members IS NOT NULL
      AND auth.uid() = ANY(group_members)
    )
  );

-- Allow sender to DELETE their own messages (hard delete for everyone)
DROP POLICY IF EXISTS "Users delete own messages" ON public.messenger_messages;
CREATE POLICY "Users delete own messages"
  ON public.messenger_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- ================================================================
-- PART 3: message_user_state — per-user soft delete
-- ================================================================

CREATE TABLE IF NOT EXISTS public.message_user_state (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

ALTER TABLE public.message_user_state ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.message_user_state TO authenticated;
GRANT ALL ON public.message_user_state TO service_role;

-- Users can only manage their own state
DROP POLICY IF EXISTS "Users manage own message state" ON public.message_user_state;
CREATE POLICY "Users manage own message state"
  ON public.message_user_state FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Index for fast lookup when rendering chat
CREATE INDEX IF NOT EXISTS idx_mus_user_msg
  ON public.message_user_state(user_id, message_id);

-- Add to realtime so hidden messages disappear instantly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND tablename='message_user_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.message_user_state;
  END IF;
END $$;

-- ================================================================
-- END OF MIGRATION
-- ================================================================

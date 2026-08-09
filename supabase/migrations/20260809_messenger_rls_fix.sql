-- ============================================================
-- Messenger RLS Security Fix
-- Fixes three RLS policies on grouping_notifications so that:
--   1. Senders can SELECT their own sent messages (currently blocked)
--   2. Senders can UPDATE metadata on their own messages (for reactions)
--   3. Senders can DELETE their own messages (not just recipients)
-- ============================================================

-- ── Fix SELECT policy ──
-- Old: recipient_id = auth.uid() OR is_leadership(auth.uid())
-- New: recipient OR sender can read. Leadership can read all.
DROP POLICY IF EXISTS "View own notifications" ON public.grouping_notifications;
CREATE POLICY "View own notifications"
  ON public.grouping_notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR sender_id = auth.uid()
    OR is_leadership(auth.uid())
  );

-- ── Fix UPDATE policy ──
-- Old: recipient_id = auth.uid()  (reactions on incoming messages only)
-- New: sender OR recipient can update (sender needs to update metadata/reactions on sent messages)
DROP POLICY IF EXISTS "Update own notifications" ON public.grouping_notifications;
CREATE POLICY "Update own notifications"
  ON public.grouping_notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR sender_id = auth.uid()
  );

-- ── Fix DELETE policy ──
-- Old: is_leadership(auth.uid()) OR recipient_id = auth.uid()
-- New: sender can also delete their own messages
DROP POLICY IF EXISTS "Delete notifications" ON public.grouping_notifications;
CREATE POLICY "Delete notifications"
  ON public.grouping_notifications
  FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR recipient_id = auth.uid()
    OR is_leadership(auth.uid())
  );

-- ── Ensure expires_at index exists for performance ──
CREATE INDEX IF NOT EXISTS idx_grouping_notifications_expires_active
  ON public.grouping_notifications (expires_at)
  WHERE expires_at IS NOT NULL;

-- ── Sender-side index for sent message lookups ──
CREATE INDEX IF NOT EXISTS idx_grouping_notifications_sender_created
  ON public.grouping_notifications (sender_id, created_at DESC);

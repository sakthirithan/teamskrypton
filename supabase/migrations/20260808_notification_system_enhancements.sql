-- Enhancements to grouping_notifications table for targeted messaging and 24-hour broadcasts
ALTER TABLE public.grouping_notifications
  ADD COLUMN IF NOT EXISTS target_audience TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_broadcast BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Index for efficient querying by recipient, creation date, and broadcast expiration
CREATE INDEX IF NOT EXISTS idx_grouping_notifications_recipient_created 
  ON public.grouping_notifications(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grouping_notifications_expires 
  ON public.grouping_notifications(expires_at) 
  WHERE expires_at IS NOT NULL;

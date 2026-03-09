-- Add block_shape column to skill_flowchart_blocks for user-selectable shapes
ALTER TABLE public.skill_flowchart_blocks 
ADD COLUMN block_shape text NOT NULL DEFAULT 'rectangle';

-- Add is_sequential column to skill_tracks for learning path enforcement
ALTER TABLE public.skill_tracks 
ADD COLUMN is_sequential boolean NOT NULL DEFAULT false;

-- Create skill_activity_log table for member activity feed
CREATE TABLE public.skill_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  description text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.skill_activity_log ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view activity
CREATE POLICY "View skill activity" ON public.skill_activity_log
FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

-- Users can insert their own activity
CREATE POLICY "Insert own skill activity" ON public.skill_activity_log
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Leadership can delete activity logs
CREATE POLICY "Leadership delete activity" ON public.skill_activity_log
FOR DELETE TO authenticated
USING (is_leadership(auth.uid()));

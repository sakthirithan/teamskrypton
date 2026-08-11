-- Migration to enforce activity edit restrictions after finalization and update RLS policies

-- 1. Drop existing policies on schedule_activities
DROP POLICY IF EXISTS "Owner or leadership update activities" ON public.schedule_activities;
DROP POLICY IF EXISTS "Owner or leadership delete activities" ON public.schedule_activities;

-- 2. Re-create update policy:
-- Incharges can update their own activities ONLY IF status is not 'final' (or 'finalized').
-- Leadership (Strategist, Team Captain, Vice Captain, Team Manager) can update any activity at any status.
CREATE POLICY "Incharge update unfinalized activities or leadership update all"
  ON public.schedule_activities FOR UPDATE TO authenticated
  USING (
    public.is_leadership(auth.uid())
    OR (created_by = auth.uid() AND status != 'final' AND status != 'finalized')
  )
  WITH CHECK (
    public.is_leadership(auth.uid())
    OR (created_by = auth.uid() AND status != 'final' AND status != 'finalized')
  );

-- 3. Re-create delete policy:
CREATE POLICY "Incharge delete unfinalized activities or leadership delete all"
  ON public.schedule_activities FOR DELETE TO authenticated
  USING (
    public.is_leadership(auth.uid())
    OR (created_by = auth.uid() AND status != 'final' AND status != 'finalized')
  );

-- 4. Update schedule_activity_members RLS policies for modifications:
DROP POLICY IF EXISTS "Owner or leadership manage activity members" ON public.schedule_activity_members;

CREATE POLICY "Owner or leadership manage activity members"
  ON public.schedule_activity_members FOR ALL TO authenticated
  USING (
    public.is_leadership(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.schedule_activities a
      WHERE a.id = activity_id
        AND a.created_by = auth.uid()
        AND a.status != 'final'
        AND a.status != 'finalized'
    )
  )
  WITH CHECK (
    public.is_leadership(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.schedule_activities a
      WHERE a.id = activity_id
        AND a.created_by = auth.uid()
        AND a.status != 'final'
        AND a.status != 'finalized'
    )
  );

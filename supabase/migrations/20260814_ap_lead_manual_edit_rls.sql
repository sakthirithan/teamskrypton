-- Migration: RLS Policies for Activity Points (AP) Leadership Manual Editing
ALTER TABLE public.activity_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leadership insert activity points" ON public.activity_points;
DROP POLICY IF EXISTS "Leadership update activity points" ON public.activity_points;
DROP POLICY IF EXISTS "Leadership delete activity points" ON public.activity_points;

CREATE POLICY "Leadership insert activity points"
  ON public.activity_points FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
    )
  );

CREATE POLICY "Leadership update activity points"
  ON public.activity_points FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
    )
  );

CREATE POLICY "Leadership delete activity points"
  ON public.activity_points FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
    )
  );

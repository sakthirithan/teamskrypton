-- Migration: Fix RLS Policies & Counts for Daily Survey Responses and Monitoring Records

-- 1. Update Daily Survey Responses RLS Policies to allow Leadership Upserts
DROP POLICY IF EXISTS "Users view own survey responses or leadership views all" ON public.daily_survey_responses;
DROP POLICY IF EXISTS "Users insert own survey response" ON public.daily_survey_responses;
DROP POLICY IF EXISTS "Users update own survey response" ON public.daily_survey_responses;
DROP POLICY IF EXISTS "Leadership manage survey responses" ON public.daily_survey_responses;

CREATE POLICY "Users view own survey responses or leadership views all"
  ON public.daily_survey_responses FOR SELECT TO public
  USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
    )
  );

CREATE POLICY "Users insert own survey response or leadership inserts for member"
  ON public.daily_survey_responses FOR INSERT TO public
  WITH CHECK (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
    )
  );

CREATE POLICY "Users update own survey response or leadership updates for member"
  ON public.daily_survey_responses FOR UPDATE TO public
  USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
    )
  );

CREATE POLICY "Users delete own survey response or leadership deletes for member"
  ON public.daily_survey_responses FOR DELETE TO public
  USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
    )
  );

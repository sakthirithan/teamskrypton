-- Migration: Individual Targets, Lead Overrides, and RLS Fixes

-- 1. Fix RLS on monitoring_targets (Drop restrictive policies & create clean policies)
DROP POLICY IF EXISTS "Allow public select on monitoring_targets" ON public.monitoring_targets;
DROP POLICY IF EXISTS "Allow leadership update on monitoring_targets" ON public.monitoring_targets;

CREATE POLICY "Enable select for all authenticated users"
  ON public.monitoring_targets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON public.monitoring_targets FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON public.monitoring_targets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 2. Individual Monitoring Targets Table (Per-member target overrides)
CREATE TABLE IF NOT EXISTS public.individual_monitoring_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  required_ap_target INTEGER,
  required_ps_target INTEGER,
  required_meeting_target INTEGER,
  required_survey_target INTEGER,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.individual_monitoring_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable select for authenticated on individual_monitoring_targets"
  ON public.individual_monitoring_targets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated on individual_monitoring_targets"
  ON public.individual_monitoring_targets FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated on individual_monitoring_targets"
  ON public.individual_monitoring_targets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 3. Group Meeting Completion Manual Overrides Table
CREATE TABLE IF NOT EXISTS public.monitoring_meeting_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'pending'
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, meeting_date)
);

ALTER TABLE public.monitoring_meeting_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable select for authenticated on monitoring_meeting_records"
  ON public.monitoring_meeting_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated on monitoring_meeting_records"
  ON public.monitoring_meeting_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated on monitoring_meeting_records"
  ON public.monitoring_meeting_records FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 4. Fix RLS on daily_survey_responses for lead manual responses & actionable clicks
DROP POLICY IF EXISTS "Users insert own survey response" ON public.daily_survey_responses;
DROP POLICY IF EXISTS "Users update own survey response" ON public.daily_survey_responses;
DROP POLICY IF EXISTS "Users view own survey responses or leadership views all" ON public.daily_survey_responses;

CREATE POLICY "Select survey responses"
  ON public.daily_survey_responses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Insert survey responses"
  ON public.daily_survey_responses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Update survey responses"
  ON public.daily_survey_responses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_individual_monitoring_targets_user ON public.individual_monitoring_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_meeting_records_user ON public.monitoring_meeting_records(user_id, meeting_date);

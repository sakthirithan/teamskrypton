-- Migration: Centralized Monitoring & Alert System Schema
-- Creates tables for monitoring targets, daily survey responses, and alert logs.

-- 1. Create monitoring_targets table
CREATE TABLE IF NOT EXISTS public.monitoring_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NULL,
  target_type TEXT NOT NULL, -- 'ap', 'ps', 'meeting', 'survey'
  required_value INTEGER NOT NULL DEFAULT 1,
  period TEXT NOT NULL DEFAULT 'weekly', -- 'daily', 'weekly', 'session'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID NULL,
  UNIQUE(session_id, target_type)
);

-- Insert default targets if not exists (global defaults with session_id NULL)
INSERT INTO public.monitoring_targets (session_id, target_type, required_value, period)
VALUES 
  (NULL, 'ap', 4200, 'session'),
  (NULL, 'ps', 1, 'weekly'),
  (NULL, 'meeting', 1, 'weekly'),
  (NULL, 'survey', 4, 'weekly')
ON CONFLICT (session_id, target_type) DO NOTHING;

-- 2. Create daily_survey_responses table
CREATE TABLE IF NOT EXISTS public.daily_survey_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  survey_date DATE NOT NULL DEFAULT CURRENT_DATE,
  session_id UUID NULL,
  responses JSONB NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, survey_date)
);

-- 3. Create monitoring_alert_logs table for follow-ups and idempotent 6:30 PM reminders
CREATE TABLE IF NOT EXISTS public.monitoring_alert_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  alert_type TEXT NOT NULL, -- 'daily_survey', 'ps_missing', 'ap_missing', 'requirement_alert', '630_pm_reminder'
  target_criteria TEXT NULL,
  idempotent_key TEXT NULL UNIQUE,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  follow_up_due_at TIMESTAMP WITH TIME ZONE NULL,
  follow_up_sent BOOLEAN NOT NULL DEFAULT false,
  follow_up_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'not_yet', 'expired'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.monitoring_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_alert_logs ENABLE ROW LEVEL SECURITY;

-- RLS for monitoring_targets
DROP POLICY IF EXISTS "Everyone can view monitoring targets" ON public.monitoring_targets;
CREATE POLICY "Everyone can view monitoring targets"
ON public.monitoring_targets FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Leads can insert/update monitoring targets" ON public.monitoring_targets;
CREATE POLICY "Leads can insert/update monitoring targets"
ON public.monitoring_targets FOR ALL
USING (
  has_role(auth.uid(), 'team_captain'::krypton_role)
  OR has_role(auth.uid(), 'team_manager'::krypton_role)
  OR has_role(auth.uid(), 'strategist'::krypton_role)
  OR has_role(auth.uid(), 'admin'::krypton_role)
);

-- RLS for daily_survey_responses
DROP POLICY IF EXISTS "Users can view own survey responses or leads view all" ON public.daily_survey_responses;
CREATE POLICY "Users can view own survey responses or leads view all"
ON public.daily_survey_responses FOR SELECT
USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'team_captain'::krypton_role)
  OR has_role(auth.uid(), 'team_manager'::krypton_role)
  OR has_role(auth.uid(), 'strategist'::krypton_role)
  OR has_role(auth.uid(), 'admin'::krypton_role)
);

DROP POLICY IF EXISTS "Users can create own daily survey responses" ON public.daily_survey_responses;
CREATE POLICY "Users can create own daily survey responses"
ON public.daily_survey_responses FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS for monitoring_alert_logs
DROP POLICY IF EXISTS "Authenticated users can view own alert logs or leads view all" ON public.monitoring_alert_logs;
CREATE POLICY "Authenticated users can view own alert logs or leads view all"
ON public.monitoring_alert_logs FOR SELECT
USING (
  auth.uid() = recipient_id
  OR auth.uid() = sender_id
  OR has_role(auth.uid(), 'team_captain'::krypton_role)
  OR has_role(auth.uid(), 'team_manager'::krypton_role)
  OR has_role(auth.uid(), 'strategist'::krypton_role)
  OR has_role(auth.uid(), 'admin'::krypton_role)
);

DROP POLICY IF EXISTS "Leads and system can insert alert logs" ON public.monitoring_alert_logs;
CREATE POLICY "Leads and system can insert alert logs"
ON public.monitoring_alert_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Recipients can update follow up status" ON public.monitoring_alert_logs;
CREATE POLICY "Recipients can update follow up status"
ON public.monitoring_alert_logs FOR UPDATE
USING (auth.uid() = recipient_id OR auth.uid() = sender_id);

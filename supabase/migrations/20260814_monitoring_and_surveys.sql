-- Centralized Monitoring and Alert System Tables & RLS

-- 1. Monitoring Targets Configuration Table
CREATE TABLE IF NOT EXISTS public.monitoring_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  required_ap_target INTEGER NOT NULL DEFAULT 4200,
  required_ps_target INTEGER NOT NULL DEFAULT 1,
  required_meeting_target INTEGER NOT NULL DEFAULT 1,
  required_survey_target INTEGER NOT NULL DEFAULT 4,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Ensure a default row exists
INSERT INTO public.monitoring_targets (required_ap_target, required_ps_target, required_meeting_target, required_survey_target)
SELECT 4200, 1, 1, 4
WHERE NOT EXISTS (SELECT 1 FROM public.monitoring_targets);

ALTER TABLE public.monitoring_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on monitoring_targets"
  ON public.monitoring_targets FOR SELECT TO public USING (true);

CREATE POLICY "Allow leadership update on monitoring_targets"
  ON public.monitoring_targets FOR ALL TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
    )
  );

-- 2. Daily Survey Responses Table
CREATE TABLE IF NOT EXISTS public.daily_survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  survey_date DATE NOT NULL DEFAULT CURRENT_DATE,
  answers JSONB DEFAULT '{}'::jsonb,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(user_id, survey_date)
);

ALTER TABLE public.daily_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own survey responses or leadership views all"
  ON public.daily_survey_responses FOR SELECT TO public
  USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
    )
  );

CREATE POLICY "Users insert own survey response"
  ON public.daily_survey_responses FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own survey response"
  ON public.daily_survey_responses FOR UPDATE TO public
  USING (auth.uid() = user_id);

-- 3. Monitoring Alerts Log Table (Track sent alerts, 5-min/10-min follow-ups, and idempotent keys)
CREATE TABLE IF NOT EXISTS public.monitoring_alerts_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'daily_survey', 'ps_reminder', 'ap_reminder', 'general_requirement'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'not_yet'
  followup_sent BOOLEAN DEFAULT false,
  followup_scheduled_at TIMESTAMP WITH TIME ZONE,
  idempotent_key TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.monitoring_alerts_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sent or received monitoring alerts"
  ON public.monitoring_alerts_log FOR SELECT TO public
  USING (
    auth.uid() = recipient_id OR auth.uid() = sender_id OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
    )
  );

CREATE POLICY "Leadership insert monitoring alerts"
  ON public.monitoring_alerts_log FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Users update monitoring alerts"
  ON public.monitoring_alerts_log FOR UPDATE TO public
  USING (auth.uid() = recipient_id OR auth.uid() = sender_id OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('team_captain', 'vice_captain', 'strategist', 'team_manager')
  ));

-- Create indexes for fast aggregated monitoring queries
CREATE INDEX IF NOT EXISTS idx_daily_survey_responses_user_date ON public.daily_survey_responses(user_id, survey_date);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_log_recipient ON public.monitoring_alerts_log(recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_log_idempotent ON public.monitoring_alerts_log(idempotent_key);

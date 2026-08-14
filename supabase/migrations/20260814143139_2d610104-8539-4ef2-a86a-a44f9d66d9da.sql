-- 1. Global monitoring targets
CREATE TABLE public.monitoring_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  required_ap_target INTEGER NOT NULL DEFAULT 4200,
  required_ps_target INTEGER NOT NULL DEFAULT 1,
  required_meeting_target INTEGER NOT NULL DEFAULT 1,
  required_survey_target INTEGER NOT NULL DEFAULT 4,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_targets TO authenticated;
GRANT ALL ON public.monitoring_targets TO service_role;
ALTER TABLE public.monitoring_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "monitoring_targets_read" ON public.monitoring_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "monitoring_targets_write" ON public.monitoring_targets
  FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()));
CREATE TRIGGER monitoring_targets_updated_at BEFORE UPDATE ON public.monitoring_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Per-member target overrides
CREATE TABLE public.individual_monitoring_targets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  required_ap_target INTEGER,
  required_ps_target INTEGER,
  required_meeting_target INTEGER,
  required_survey_target INTEGER,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.individual_monitoring_targets TO authenticated;
GRANT ALL ON public.individual_monitoring_targets TO service_role;
ALTER TABLE public.individual_monitoring_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ind_targets_read" ON public.individual_monitoring_targets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ind_targets_write" ON public.individual_monitoring_targets
  FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()));
CREATE TRIGGER ind_targets_updated_at BEFORE UPDATE ON public.individual_monitoring_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Daily survey responses
CREATE TABLE public.daily_survey_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  survey_date DATE NOT NULL DEFAULT CURRENT_DATE,
  response_count INTEGER NOT NULL DEFAULT 1,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, survey_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_survey_responses TO authenticated;
GRANT ALL ON public.daily_survey_responses TO service_role;
ALTER TABLE public.daily_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "survey_read" ON public.daily_survey_responses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "survey_insert" ON public.daily_survey_responses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_leadership(auth.uid()));
CREATE POLICY "survey_update" ON public.daily_survey_responses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_leadership(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_leadership(auth.uid()));
CREATE POLICY "survey_delete" ON public.daily_survey_responses
  FOR DELETE TO authenticated USING (public.is_leadership(auth.uid()));
CREATE TRIGGER survey_updated_at BEFORE UPDATE ON public.daily_survey_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Group meeting records
CREATE TABLE public.monitoring_meeting_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, meeting_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_meeting_records TO authenticated;
GRANT ALL ON public.monitoring_meeting_records TO service_role;
ALTER TABLE public.monitoring_meeting_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meeting_read" ON public.monitoring_meeting_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "meeting_insert" ON public.monitoring_meeting_records
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_leadership(auth.uid()));
CREATE POLICY "meeting_update" ON public.monitoring_meeting_records
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_leadership(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_leadership(auth.uid()));
CREATE POLICY "meeting_delete" ON public.monitoring_meeting_records
  FOR DELETE TO authenticated USING (public.is_leadership(auth.uid()));
CREATE TRIGGER meeting_updated_at BEFORE UPDATE ON public.monitoring_meeting_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Scheduled one-off alerts
CREATE TABLE public.scheduled_monitoring_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  target_filter TEXT NOT NULL DEFAULT 'all',
  target_user_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_monitoring_alerts TO authenticated;
GRANT ALL ON public.scheduled_monitoring_alerts TO service_role;
ALTER TABLE public.scheduled_monitoring_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sched_alerts_read" ON public.scheduled_monitoring_alerts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "sched_alerts_write" ON public.scheduled_monitoring_alerts
  FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()));
CREATE TRIGGER sched_alerts_updated_at BEFORE UPDATE ON public.scheduled_monitoring_alerts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Recurring alert automation rules
CREATE TABLE public.monitoring_alert_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  criterion TEXT NOT NULL DEFAULT 'any',
  run_at_time TEXT NOT NULL DEFAULT '18:00',
  repeat_mode TEXT NOT NULL DEFAULT 'daily',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_run_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monitoring_alert_rules TO authenticated;
GRANT ALL ON public.monitoring_alert_rules TO service_role;
ALTER TABLE public.monitoring_alert_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_rules_read" ON public.monitoring_alert_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "alert_rules_write" ON public.monitoring_alert_rules
  FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()));
CREATE TRIGGER alert_rules_updated_at BEFORE UPDATE ON public.monitoring_alert_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Audit trail
CREATE TABLE public.monitoring_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id UUID,
  target_user_id UUID,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.monitoring_audit_log TO authenticated;
GRANT ALL ON public.monitoring_audit_log TO service_role;
ALTER TABLE public.monitoring_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON public.monitoring_audit_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert" ON public.monitoring_audit_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = actor_id);

CREATE INDEX idx_survey_date ON public.daily_survey_responses (survey_date);
CREATE INDEX idx_meeting_date ON public.monitoring_meeting_records (meeting_date);
CREATE INDEX idx_audit_created ON public.monitoring_audit_log (created_at DESC);
CREATE INDEX idx_sched_alerts_status ON public.scheduled_monitoring_alerts (status, scheduled_at);

INSERT INTO public.monitoring_targets (required_ap_target, required_ps_target, required_meeting_target, required_survey_target)
VALUES (4200, 1, 1, 4);
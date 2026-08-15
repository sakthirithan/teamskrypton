-- Migration to add recipient_type and target_user_ids to monitoring_alert_rules table
ALTER TABLE public.monitoring_alert_rules
  ADD COLUMN IF NOT EXISTS recipient_type TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS target_user_ids UUID[] NOT NULL DEFAULT '{}';

-- Re-apply policies to ensure complete RLS coverage
DROP POLICY IF EXISTS "alert_rules_read" ON public.monitoring_alert_rules;
DROP POLICY IF EXISTS "alert_rules_write" ON public.monitoring_alert_rules;

CREATE POLICY "alert_rules_read" ON public.monitoring_alert_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "alert_rules_write" ON public.monitoring_alert_rules
  FOR ALL TO authenticated
  USING (public.is_leadership(auth.uid()))
  WITH CHECK (public.is_leadership(auth.uid()));

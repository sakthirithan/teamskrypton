-- Migration: Scheduled Monitoring Alerts Table & Idempotency
CREATE TABLE IF NOT EXISTS public.scheduled_monitoring_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_filter TEXT NOT NULL DEFAULT 'missing_survey',
  target_user_ids UUID[],
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'sent', 'cancelled'
  idempotent_key TEXT UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.scheduled_monitoring_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for authenticated on scheduled_monitoring_alerts"
  ON public.scheduled_monitoring_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_scheduled_alerts_status ON public.scheduled_monitoring_alerts(status, scheduled_at);

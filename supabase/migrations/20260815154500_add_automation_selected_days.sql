-- Migration to add selected_days to monitoring_alert_rules table
ALTER TABLE public.monitoring_alert_rules
  ADD COLUMN IF NOT EXISTS selected_days INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}';

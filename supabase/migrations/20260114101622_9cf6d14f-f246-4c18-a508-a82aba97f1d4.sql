-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Add expires_at column to task_alerts for tracking expiry
ALTER TABLE public.task_alerts 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add reason_submitted column to track if user submitted a reason
ALTER TABLE public.task_alerts 
ADD COLUMN IF NOT EXISTS has_response BOOLEAN DEFAULT false;

-- Function to set expiry based on alert type
CREATE OR REPLACE FUNCTION public.set_alert_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Default: 48 hours for alerts without response
  NEW.expires_at := NOW() + INTERVAL '48 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-set expiry on insert
DROP TRIGGER IF EXISTS set_alert_expiry_trigger ON public.task_alerts;
CREATE TRIGGER set_alert_expiry_trigger
BEFORE INSERT ON public.task_alerts
FOR EACH ROW
EXECUTE FUNCTION public.set_alert_expiry();

-- Function to update expiry when response is submitted (24hr from response)
CREATE OR REPLACE FUNCTION public.update_alert_expiry_on_response()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.has_response = true AND (OLD.has_response IS NULL OR OLD.has_response = false) THEN
    NEW.expires_at := NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for response updates
DROP TRIGGER IF EXISTS update_alert_expiry_trigger ON public.task_alerts;
CREATE TRIGGER update_alert_expiry_trigger
BEFORE UPDATE ON public.task_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_alert_expiry_on_response();

-- Add expires_at to approvals table for system alerts (24hr auto-delete)
ALTER TABLE public.approvals 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
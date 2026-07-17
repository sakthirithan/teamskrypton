
CREATE TABLE public.email_delivery_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID,
  recipient_email TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  provider_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.email_delivery_log TO authenticated;
GRANT ALL ON public.email_delivery_log TO service_role;

ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leadership can view all email logs"
ON public.email_delivery_log FOR SELECT
TO authenticated
USING (public.is_leadership(auth.uid()));

CREATE POLICY "Senders can view their own email logs"
ON public.email_delivery_log FOR SELECT
TO authenticated
USING (sender_id = auth.uid());

CREATE TRIGGER update_email_delivery_log_updated_at
BEFORE UPDATE ON public.email_delivery_log
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_email_delivery_log_sender ON public.email_delivery_log(sender_id, created_at DESC);
CREATE INDEX idx_email_delivery_log_status ON public.email_delivery_log(status, created_at DESC);

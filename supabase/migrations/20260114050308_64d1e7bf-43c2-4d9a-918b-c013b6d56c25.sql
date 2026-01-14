-- Create task_alerts table for leadership alert messages
CREATE TABLE public.task_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_test BOOLEAN DEFAULT false
);

-- Enable RLS
ALTER TABLE public.task_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Leadership can create alerts
CREATE POLICY "Leadership can create task alerts"
ON public.task_alerts
FOR INSERT
WITH CHECK (is_leadership(auth.uid()));

-- Policy: Users can view alerts for tasks assigned to them
CREATE POLICY "Users can view their task alerts"
ON public.task_alerts
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND
  (
    is_leadership(auth.uid()) OR
    task_id IN (SELECT id FROM public.tasks WHERE assigned_to = auth.uid())
  )
);

-- Policy: Users can update read status of their alerts
CREATE POLICY "Users can mark alerts as read"
ON public.task_alerts
FOR UPDATE
USING (
  task_id IN (SELECT id FROM public.tasks WHERE assigned_to = auth.uid())
);

-- Add index for performance
CREATE INDEX idx_task_alerts_task_id ON public.task_alerts(task_id);
CREATE INDEX idx_task_alerts_created_at ON public.task_alerts(created_at DESC);
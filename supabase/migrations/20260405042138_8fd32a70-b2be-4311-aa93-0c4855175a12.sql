
-- Activity Points table: manual points entry by leadership
CREATE TABLE public.activity_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID REFERENCES public.grouping_sessions(id) ON DELETE CASCADE NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  awarded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View activity points" ON public.activity_points
  FOR SELECT TO public
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Leadership manages activity points" ON public.activity_points
  FOR INSERT TO public
  WITH CHECK (is_leadership(auth.uid()));

CREATE POLICY "Leadership updates activity points" ON public.activity_points
  FOR UPDATE TO public
  USING (is_leadership(auth.uid()));

CREATE POLICY "Leadership deletes activity points" ON public.activity_points
  FOR DELETE TO public
  USING (is_leadership(auth.uid()));

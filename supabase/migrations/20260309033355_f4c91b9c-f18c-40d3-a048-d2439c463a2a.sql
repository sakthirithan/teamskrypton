
-- Daily study board: study links + to-do items that expire after 24 hours
CREATE TABLE public.daily_study_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL DEFAULT 'link', -- 'link' or 'todo'
  title TEXT NOT NULL,
  url TEXT, -- for links
  is_completed BOOLEAN NOT NULL DEFAULT false, -- for todos
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

ALTER TABLE public.daily_study_items ENABLE ROW LEVEL SECURITY;

-- Users can view their own items + leadership can view all
CREATE POLICY "View own daily study items"
  ON public.daily_study_items FOR SELECT
  USING (auth.uid() = user_id OR is_leadership(auth.uid()));

-- Users can create their own items
CREATE POLICY "Create own daily study items"
  ON public.daily_study_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own items (toggle completed)
CREATE POLICY "Update own daily study items"
  ON public.daily_study_items FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own items
CREATE POLICY "Delete own daily study items"
  ON public.daily_study_items FOR DELETE
  USING (auth.uid() = user_id);

-- Function to cleanup expired items
CREATE OR REPLACE FUNCTION public.cleanup_expired_study_items()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.daily_study_items WHERE expires_at < now();
END;
$$;

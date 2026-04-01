
-- Habits table: created by leads, apply to all or self-created
CREATE TABLE public.habits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  is_global BOOLEAN NOT NULL DEFAULT false,
  user_id UUID, -- NULL for global habits, set for personal habits
  session_id UUID REFERENCES public.grouping_sessions(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habit completions: track daily completions per user
CREATE TABLE public.habit_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  completion_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(habit_id, user_id, completion_date)
);

-- Habit revoke requests: when user has no achievements, goes to lead approval
CREATE TABLE public.habit_revoke_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for habits
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_revoke_requests ENABLE ROW LEVEL SECURITY;

-- Habits policies
CREATE POLICY "View habits" ON public.habits FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Leadership creates global habits" ON public.habits FOR INSERT WITH CHECK (
  (is_global = true AND is_leadership(auth.uid())) OR
  (is_global = false AND auth.uid() = user_id)
);
CREATE POLICY "Leadership updates habits" ON public.habits FOR UPDATE USING (
  is_leadership(auth.uid()) OR (auth.uid() = user_id AND is_global = false)
);
CREATE POLICY "Leadership deletes habits" ON public.habits FOR DELETE USING (
  is_leadership(auth.uid()) OR (auth.uid() = user_id AND is_global = false)
);

-- Habit completions policies
CREATE POLICY "View completions" ON public.habit_completions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Mark own completions" ON public.habit_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own completions" ON public.habit_completions FOR DELETE USING (auth.uid() = user_id);

-- Revoke requests policies
CREATE POLICY "View revoke requests" ON public.habit_revoke_requests FOR SELECT USING (
  auth.uid() = user_id OR is_leadership(auth.uid())
);
CREATE POLICY "Create revoke request" ON public.habit_revoke_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Leadership reviews revoke" ON public.habit_revoke_requests FOR UPDATE USING (is_leadership(auth.uid()));
CREATE POLICY "Leadership deletes revoke" ON public.habit_revoke_requests FOR DELETE USING (is_leadership(auth.uid()));


-- 1. Skill Reflections table (weekly reflections per skill track)
CREATE TABLE public.skill_reflections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_track_id UUID NOT NULL REFERENCES public.skill_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  content TEXT NOT NULL,
  challenges TEXT,
  next_steps TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(skill_track_id, week_start)
);

ALTER TABLE public.skill_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View skill reflections" ON public.skill_reflections
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users create own reflections" ON public.skill_reflections
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reflections" ON public.skill_reflections
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own reflections" ON public.skill_reflections
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_leadership(auth.uid()));

-- 2. Skill Endorsements table
CREATE TABLE public.skill_endorsements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_skill_id UUID NOT NULL REFERENCES public.member_skills(id) ON DELETE CASCADE,
  endorsed_user_id UUID NOT NULL,
  endorsed_by UUID NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_skill_id, endorsed_by)
);

ALTER TABLE public.skill_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View endorsements" ON public.skill_endorsements
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users create endorsements" ON public.skill_endorsements
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = endorsed_by AND auth.uid() != endorsed_user_id);

CREATE POLICY "Users delete own endorsements" ON public.skill_endorsements
  FOR DELETE TO authenticated
  USING (auth.uid() = endorsed_by);

-- 3. Skill Streaks table
CREATE TABLE public.skill_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  total_active_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_id)
);

ALTER TABLE public.skill_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View skill streaks" ON public.skill_streaks
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users manage own streaks" ON public.skill_streaks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own streaks" ON public.skill_streaks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

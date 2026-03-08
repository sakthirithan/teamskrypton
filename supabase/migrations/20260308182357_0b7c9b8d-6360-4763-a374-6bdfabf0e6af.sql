
-- Skill Levels: XP-based leveling system for member skills
CREATE TABLE public.skill_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_id)
);

-- XP Activity Log: tracks what earned XP
CREATE TABLE public.skill_xp_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  xp_amount integer NOT NULL,
  activity_type text NOT NULL, -- 'flowchart_step', 'reflection', 'endorsement_received', 'dev_link', 'streak_bonus', 'ps_completed'
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Skill Challenges: weekly AI-generated or manual challenges
CREATE TABLE public.skill_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  xp_reward integer NOT NULL DEFAULT 50,
  difficulty text NOT NULL DEFAULT 'medium', -- 'easy', 'medium', 'hard'
  created_by uuid NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Challenge completions
CREATE TABLE public.skill_challenge_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.skill_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  proof_text text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  UNIQUE(challenge_id, user_id)
);

-- Enable RLS
ALTER TABLE public.skill_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_challenge_completions ENABLE ROW LEVEL SECURITY;

-- RLS: skill_levels
CREATE POLICY "View skill levels" ON public.skill_levels FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Upsert own skill levels" ON public.skill_levels FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own skill levels" ON public.skill_levels FOR UPDATE USING (auth.uid() = user_id OR is_leadership(auth.uid()));

-- RLS: skill_xp_log
CREATE POLICY "View xp log" ON public.skill_xp_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Insert xp log" ON public.skill_xp_log FOR INSERT WITH CHECK (auth.uid() = user_id OR is_leadership(auth.uid()));

-- RLS: skill_challenges
CREATE POLICY "View challenges" ON public.skill_challenges FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Leadership creates challenges" ON public.skill_challenges FOR INSERT WITH CHECK (is_leadership(auth.uid()));
CREATE POLICY "Leadership updates challenges" ON public.skill_challenges FOR UPDATE USING (is_leadership(auth.uid()));
CREATE POLICY "Leadership deletes challenges" ON public.skill_challenges FOR DELETE USING (is_leadership(auth.uid()));

-- RLS: skill_challenge_completions
CREATE POLICY "View completions" ON public.skill_challenge_completions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Submit completion" ON public.skill_challenge_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Leadership approves" ON public.skill_challenge_completions FOR UPDATE USING (is_leadership(auth.uid()));

-- Enable realtime for leaderboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.skill_levels;

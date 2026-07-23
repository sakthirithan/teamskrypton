
-- POLLS
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('grouping', 'pbl')),
  session_id UUID,
  project_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  allow_multiple BOOLEAN NOT NULL DEFAULT false,
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  results_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO authenticated;
GRANT ALL ON public.polls TO service_role;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "polls_select_all" ON public.polls FOR SELECT TO authenticated USING (true);
CREATE POLICY "polls_insert_own" ON public.polls FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "polls_update_creator" ON public.polls FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "polls_delete_creator" ON public.polls FOR DELETE TO authenticated USING (auth.uid() = creator_id);
CREATE TRIGGER polls_updated BEFORE UPDATE ON public.polls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- OPTIONS
CREATE TABLE public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO authenticated;
GRANT ALL ON public.poll_options TO service_role;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_options_select_all" ON public.poll_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_options_write_creator" ON public.poll_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.creator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.creator_id = auth.uid()));

-- VOTES
CREATE TABLE public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, option_id, voter_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO authenticated;
GRANT ALL ON public.poll_votes TO service_role;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_votes_select_all" ON public.poll_votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_votes_insert_own" ON public.poll_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "poll_votes_delete_own" ON public.poll_votes FOR DELETE TO authenticated USING (auth.uid() = voter_id);

-- VOTE TOKENS (email one-click)
CREATE TABLE public.poll_vote_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);
GRANT SELECT ON public.poll_vote_tokens TO authenticated;
GRANT ALL ON public.poll_vote_tokens TO service_role;
ALTER TABLE public.poll_vote_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_vote_tokens_select_own" ON public.poll_vote_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- TEAMS
CREATE TABLE public.poll_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  based_on_option_id UUID REFERENCES public.poll_options(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_teams TO authenticated;
GRANT ALL ON public.poll_teams TO service_role;
ALTER TABLE public.poll_teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_teams_select_all" ON public.poll_teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_teams_write_creator" ON public.poll_teams FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.creator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.polls p WHERE p.id = poll_id AND p.creator_id = auth.uid()));

-- TEAM MEMBERS
CREATE TABLE public.poll_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.poll_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_team_members TO authenticated;
GRANT ALL ON public.poll_team_members TO service_role;
ALTER TABLE public.poll_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "poll_team_members_select_all" ON public.poll_team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "poll_team_members_write_creator" ON public.poll_team_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.poll_teams t JOIN public.polls p ON p.id = t.poll_id WHERE t.id = team_id AND p.creator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.poll_teams t JOIN public.polls p ON p.id = t.poll_id WHERE t.id = team_id AND p.creator_id = auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_team_members;

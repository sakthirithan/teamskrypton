
-- Predefined skill suggestions table (leadership can manage)
CREATE TABLE public.skill_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT DEFAULT 'general',
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User skill tracks per session (multiple skills per week)
CREATE TABLE public.skill_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  skill_name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  week_start DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Flowchart blocks for learning steps
CREATE TABLE public.skill_flowchart_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_track_id UUID NOT NULL REFERENCES public.skill_tracks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  resource_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.skill_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_flowchart_blocks ENABLE ROW LEVEL SECURITY;

-- skill_suggestions policies
CREATE POLICY "Anyone can view skill suggestions" ON public.skill_suggestions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Leadership can manage skill suggestions" ON public.skill_suggestions FOR INSERT WITH CHECK (is_leadership(auth.uid()));
CREATE POLICY "Leadership can delete skill suggestions" ON public.skill_suggestions FOR DELETE USING (is_leadership(auth.uid()));

-- skill_tracks policies
CREATE POLICY "View skill tracks" ON public.skill_tracks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users create own skill tracks" ON public.skill_tracks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own skill tracks" ON public.skill_tracks FOR UPDATE USING (auth.uid() = user_id OR is_leadership(auth.uid()));
CREATE POLICY "Users delete own skill tracks" ON public.skill_tracks FOR DELETE USING (auth.uid() = user_id OR is_leadership(auth.uid()));

-- skill_flowchart_blocks policies (inherit from skill_track ownership)
CREATE POLICY "View flowchart blocks" ON public.skill_flowchart_blocks FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Create flowchart blocks" ON public.skill_flowchart_blocks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.skill_tracks WHERE id = skill_track_id AND (user_id = auth.uid() OR is_leadership(auth.uid())))
);
CREATE POLICY "Update flowchart blocks" ON public.skill_flowchart_blocks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.skill_tracks WHERE id = skill_track_id AND (user_id = auth.uid() OR is_leadership(auth.uid())))
);
CREATE POLICY "Delete flowchart blocks" ON public.skill_flowchart_blocks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.skill_tracks WHERE id = skill_track_id AND (user_id = auth.uid() OR is_leadership(auth.uid())))
);

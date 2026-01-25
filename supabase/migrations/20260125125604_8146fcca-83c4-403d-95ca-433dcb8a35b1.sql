-- =============================================
-- GROUPING TARGETS MODE - EXTENSION TABLES
-- Completely isolated from existing PBL tables
-- =============================================

-- 1. Grouping Sessions Table
CREATE TABLE public.grouping_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_test BOOLEAN DEFAULT false,
  UNIQUE (session_number)
);

-- 2. Grouping Targets Table
CREATE TABLE public.grouping_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  target_scope TEXT NOT NULL CHECK (target_scope IN ('group', 'individual')),
  user_id UUID, -- nullable for group targets
  target_points INTEGER NOT NULL DEFAULT 0,
  achieved_points INTEGER NOT NULL DEFAULT 0,
  editable BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_test BOOLEAN DEFAULT false
);

-- 3. PS Daily Entry Table
CREATE TABLE public.ps_daily_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  s_no INTEGER NOT NULL,
  session_id UUID NOT NULL REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  skill_name TEXT NOT NULL,
  reward_points INTEGER NOT NULL DEFAULT 0,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  entered_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_test BOOLEAN DEFAULT false
);

-- Enable RLS on all new tables
ALTER TABLE public.grouping_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grouping_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_daily_entries ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES FOR GROUPING_SESSIONS
-- =============================================

-- Leadership can view all sessions
CREATE POLICY "Leadership can view all sessions"
ON public.grouping_sessions
FOR SELECT
USING (is_leadership(auth.uid()) OR is_test = false);

-- Only TL/VC can create sessions
CREATE POLICY "TL/VC can create sessions"
ON public.grouping_sessions
FOR INSERT
WITH CHECK (is_captain_or_vice(auth.uid()));

-- Only TL/VC can update sessions
CREATE POLICY "TL/VC can update sessions"
ON public.grouping_sessions
FOR UPDATE
USING (is_captain_or_vice(auth.uid()));

-- Only TL/VC can delete sessions
CREATE POLICY "TL/VC can delete sessions"
ON public.grouping_sessions
FOR DELETE
USING (is_captain_or_vice(auth.uid()));

-- =============================================
-- RLS POLICIES FOR GROUPING_TARGETS
-- =============================================

-- Authenticated users can view targets (own or leadership sees all)
CREATE POLICY "Users can view relevant targets"
ON public.grouping_targets
FOR SELECT
USING (
  is_leadership(auth.uid()) 
  OR target_scope = 'group' 
  OR user_id = auth.uid()
);

-- TL/VC can create targets
CREATE POLICY "TL/VC can create targets"
ON public.grouping_targets
FOR INSERT
WITH CHECK (is_captain_or_vice(auth.uid()));

-- TL/VC can update any target, users can update own if editable
CREATE POLICY "Update targets based on role"
ON public.grouping_targets
FOR UPDATE
USING (
  is_captain_or_vice(auth.uid()) 
  OR (user_id = auth.uid() AND editable = true)
);

-- Only TL/VC can delete targets
CREATE POLICY "TL/VC can delete targets"
ON public.grouping_targets
FOR DELETE
USING (is_captain_or_vice(auth.uid()));

-- =============================================
-- RLS POLICIES FOR PS_DAILY_ENTRIES
-- =============================================

-- Users can view own entries, leadership sees all
CREATE POLICY "View PS entries based on role"
ON public.ps_daily_entries
FOR SELECT
USING (
  is_leadership(auth.uid()) 
  OR user_id = auth.uid()
);

-- Users can create their own entries
CREATE POLICY "Users can create own PS entries"
ON public.ps_daily_entries
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  OR is_leadership(auth.uid())
);

-- Leadership can update any, users can update own
CREATE POLICY "Update PS entries based on role"
ON public.ps_daily_entries
FOR UPDATE
USING (
  is_leadership(auth.uid()) 
  OR (user_id = auth.uid() AND entered_by = auth.uid())
);

-- Only leadership can delete entries
CREATE POLICY "Leadership can delete PS entries"
ON public.ps_daily_entries
FOR DELETE
USING (is_leadership(auth.uid()));

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_grouping_sessions_updated_at
BEFORE UPDATE ON public.grouping_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grouping_targets_updated_at
BEFORE UPDATE ON public.grouping_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ps_daily_entries_updated_at
BEFORE UPDATE ON public.ps_daily_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_grouping_sessions_status ON public.grouping_sessions(status);
CREATE INDEX idx_grouping_targets_session ON public.grouping_targets(session_id);
CREATE INDEX idx_grouping_targets_user ON public.grouping_targets(user_id);
CREATE INDEX idx_ps_entries_session ON public.ps_daily_entries(session_id);
CREATE INDEX idx_ps_entries_user ON public.ps_daily_entries(user_id);
CREATE INDEX idx_ps_entries_date ON public.ps_daily_entries(entry_date);
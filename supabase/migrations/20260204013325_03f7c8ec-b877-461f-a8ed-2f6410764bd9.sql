-- Create user_points table for TL to manage individual points (common to both modes)
CREATE TABLE public.user_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  last_updated_by UUID NOT NULL,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(user_id)
);

-- Create points_history table for audit trail
CREATE TABLE public.points_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  points_change INTEGER NOT NULL,
  points_before INTEGER NOT NULL,
  points_after INTEGER NOT NULL,
  operation_type TEXT NOT NULL, -- 'add', 'subtract', 'set', 'bonus', 'penalty'
  reason TEXT,
  performed_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_points

-- Everyone can view points
CREATE POLICY "Authenticated users can view all points"
ON public.user_points
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only TL can insert points
CREATE POLICY "Only TL can create points records"
ON public.user_points
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'team_captain'::krypton_role));

-- Only TL can update points
CREATE POLICY "Only TL can update points"
ON public.user_points
FOR UPDATE
USING (has_role(auth.uid(), 'team_captain'::krypton_role));

-- Only TL can delete points
CREATE POLICY "Only TL can delete points records"
ON public.user_points
FOR DELETE
USING (has_role(auth.uid(), 'team_captain'::krypton_role));

-- RLS Policies for points_history

-- Everyone can view history
CREATE POLICY "Authenticated users can view points history"
ON public.points_history
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only TL can insert history
CREATE POLICY "Only TL can create points history"
ON public.points_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'team_captain'::krypton_role));

-- History cannot be updated or deleted (audit trail)

-- Fix: Update ps_daily_entries RLS policy to allow individuals to delete their own pending entries
DROP POLICY IF EXISTS "Leadership can delete PS entries" ON public.ps_daily_entries;

CREATE POLICY "Users can delete own pending entries or leadership can delete"
ON public.ps_daily_entries
FOR DELETE
USING (
  is_leadership(auth.uid()) 
  OR (
    user_id = auth.uid() 
    AND entered_by = auth.uid() 
    AND status = 'pending'
  )
);
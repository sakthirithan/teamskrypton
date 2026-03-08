
-- Create skill_type enum
CREATE TYPE public.skill_type AS ENUM ('primary', 'secondary', 'specialization');

-- Create skill_domain enum
CREATE TYPE public.skill_domain AS ENUM ('ai_data', 'software_dev', 'research', 'ui_ux', 'general');

-- Create member_skills table
CREATE TABLE public.member_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  skill_name TEXT NOT NULL,
  skill_type public.skill_type NOT NULL,
  domain public.skill_domain NOT NULL DEFAULT 'general',
  assigned_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.member_skills ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view member skills
CREATE POLICY "Anyone authenticated can view member skills"
  ON public.member_skills FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only leadership can insert member skills
CREATE POLICY "Leadership can assign member skills"
  ON public.member_skills FOR INSERT
  WITH CHECK (is_leadership(auth.uid()));

-- Only leadership can update member skills
CREATE POLICY "Leadership can update member skills"
  ON public.member_skills FOR UPDATE
  USING (is_leadership(auth.uid()));

-- Only leadership can delete member skills
CREATE POLICY "Leadership can delete member skills"
  ON public.member_skills FOR DELETE
  USING (is_leadership(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER update_member_skills_updated_at
  BEFORE UPDATE ON public.member_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

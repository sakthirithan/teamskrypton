-- Create approval_type enum
CREATE TYPE public.approval_type AS ENUM (
  'registration',
  'deletion_request',
  'deletion_vote',
  'task_reason',
  'report_download'
);

-- Create approval_status enum  
CREATE TYPE public.approval_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- Create approvals table for tracking all approval flows
CREATE TABLE public.approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  approval_type approval_type NOT NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  initiated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create approval_votes table to track individual votes
CREATE TABLE public.approval_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  approval_id UUID REFERENCES public.approvals(id) ON DELETE CASCADE NOT NULL,
  voter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('approve', 'reject')),
  voted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(approval_id, voter_id)
);

-- Create task_documents table for post-completion uploads
CREATE TABLE public.task_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  github_url TEXT NOT NULL,
  description TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create report_downloads table to track who downloaded reports
CREATE TABLE public.report_downloads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL,
  downloaded_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(report_date, downloaded_by)
);

-- Add assigner_name and assigner_role to tasks table
ALTER TABLE public.tasks 
ADD COLUMN assigner_name TEXT,
ADD COLUMN assigner_role TEXT;

-- Add is_direct_access to profiles for special users
ALTER TABLE public.profiles
ADD COLUMN is_direct_access BOOLEAN DEFAULT false;

-- Enable RLS on new tables
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_downloads ENABLE ROW LEVEL SECURITY;

-- RLS for approvals
CREATE POLICY "Authenticated users can view approvals" 
ON public.approvals FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Leadership can create approvals" 
ON public.approvals FOR INSERT 
WITH CHECK (is_leadership(auth.uid()) OR auth.uid() = target_user_id);

CREATE POLICY "Leadership can update approvals" 
ON public.approvals FOR UPDATE 
USING (is_leadership(auth.uid()) OR auth.uid() = target_user_id);

-- RLS for approval_votes
CREATE POLICY "Authenticated users can view votes" 
ON public.approval_votes FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can vote" 
ON public.approval_votes FOR INSERT 
WITH CHECK (auth.uid() = voter_id);

-- RLS for task_documents
CREATE POLICY "Anyone can view task documents" 
ON public.task_documents FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can upload their own documents" 
ON public.task_documents FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS for report_downloads
CREATE POLICY "Leadership can view report downloads" 
ON public.report_downloads FOR SELECT 
USING (is_leadership(auth.uid()));

CREATE POLICY "Leadership can insert report downloads" 
ON public.report_downloads FOR INSERT 
WITH CHECK (is_leadership(auth.uid()));

-- Function to check if user is TL or VC
CREATE OR REPLACE FUNCTION public.is_captain_or_vice(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('team_captain', 'vice_captain')
  )
$$;

-- Function to check if user is a team member only
CREATE OR REPLACE FUNCTION public.is_team_member_only(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'team_member'
  )
$$;

-- Update registration_requests RLS for TL/VC only approval
DROP POLICY IF EXISTS "Leadership can update registration requests" ON public.registration_requests;
CREATE POLICY "Only TL and VC can update registration requests" 
ON public.registration_requests FOR UPDATE 
USING (is_captain_or_vice(auth.uid()));

DROP POLICY IF EXISTS "Leadership can view registration requests" ON public.registration_requests;
CREATE POLICY "Only TL and VC can view registration requests" 
ON public.registration_requests FOR SELECT 
USING (is_captain_or_vice(auth.uid()));

-- Add delete policy for registration_requests
CREATE POLICY "Only TL and VC can delete registration requests" 
ON public.registration_requests FOR DELETE 
USING (is_captain_or_vice(auth.uid()));

-- Enable realtime for approvals
ALTER PUBLICATION supabase_realtime ADD TABLE public.approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.approval_votes;

-- Triggers for updated_at
CREATE TRIGGER update_approvals_updated_at
BEFORE UPDATE ON public.approvals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update trigger for tasks with pending status on deadline miss
CREATE OR REPLACE FUNCTION public.check_task_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If deadline has passed and task is not completed, set to pending
  IF NEW.deadline < now() AND NEW.status NOT IN ('completed', 'pending') THEN
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$;
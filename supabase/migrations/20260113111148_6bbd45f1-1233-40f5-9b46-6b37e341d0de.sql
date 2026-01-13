-- Add is_test column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Add is_test column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Add is_test column to workflow_log table
ALTER TABLE public.workflow_log ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Add is_test column to approvals table
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Add is_test column to approval_votes table
ALTER TABLE public.approval_votes ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Add is_test column to task_documents table
ALTER TABLE public.task_documents ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_is_test ON public.tasks(is_test);
CREATE INDEX IF NOT EXISTS idx_profiles_is_test ON public.profiles(is_test);
CREATE INDEX IF NOT EXISTS idx_workflow_log_is_test ON public.workflow_log(is_test);
CREATE INDEX IF NOT EXISTS idx_approvals_is_test ON public.approvals(is_test);
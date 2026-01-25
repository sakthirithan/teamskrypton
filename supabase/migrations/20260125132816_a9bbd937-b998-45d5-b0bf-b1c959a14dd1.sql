-- Add status column to ps_daily_entries for pending/completed workflow
ALTER TABLE public.ps_daily_entries 
ADD COLUMN status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed'));

-- Add index for efficient filtering by status
CREATE INDEX idx_ps_daily_entries_status ON public.ps_daily_entries(status);

-- Add completed_at timestamp for audit trail
ALTER TABLE public.ps_daily_entries 
ADD COLUMN completed_at timestamp with time zone DEFAULT NULL;

-- Add completed_by to track who marked it complete
ALTER TABLE public.ps_daily_entries 
ADD COLUMN completed_by uuid DEFAULT NULL;
-- Add entry_time column to ps_daily_entries for time tracking
ALTER TABLE public.ps_daily_entries 
ADD COLUMN entry_time TIME DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.ps_daily_entries.entry_time IS 'Time when the PS entry was performed by the user';
-- Create user_login_activity table for Team Manager login tracking
-- Only stores TODAY's latest login per user
-- Previous day data is automatically summarized and cleaned

CREATE TABLE public.user_login_activity (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    login_date DATE NOT NULL DEFAULT CURRENT_DATE,
    login_time TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, login_date)
);

-- Enable RLS
ALTER TABLE public.user_login_activity ENABLE ROW LEVEL SECURITY;

-- Team Managers and above can view all login activity
CREATE POLICY "Leadership can view login activity"
ON public.user_login_activity
FOR SELECT
TO authenticated
USING (
    public.is_leadership(auth.uid())
);

-- Users can insert/update their own login record
CREATE POLICY "Users can record own login"
ON public.user_login_activity
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own login time (for multiple logins per day)
CREATE POLICY "Users can update own login"
ON public.user_login_activity
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Create index for efficient date-based queries
CREATE INDEX idx_login_activity_date ON public.user_login_activity(login_date);
CREATE INDEX idx_login_activity_user ON public.user_login_activity(user_id);

-- Function to record/update login activity
CREATE OR REPLACE FUNCTION public.record_login_activity()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_login_activity (user_id, login_date, login_time)
    VALUES (
        NEW.id,
        CURRENT_DATE,
        to_char(now() AT TIME ZONE 'UTC', 'HH24:MI')
    )
    ON CONFLICT (user_id, login_date)
    DO UPDATE SET
        login_time = to_char(now() AT TIME ZONE 'UTC', 'HH24:MI'),
        created_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Cleanup function to remove old login records (keep only summary count)
CREATE OR REPLACE FUNCTION public.cleanup_old_login_activity()
RETURNS void AS $$
BEGIN
    -- Delete all records older than today
    DELETE FROM public.user_login_activity
    WHERE login_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
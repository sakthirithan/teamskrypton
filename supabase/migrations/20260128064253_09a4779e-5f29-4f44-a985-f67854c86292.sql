-- Create enum for test user types
CREATE TYPE public.test_user_type AS ENUM ('real', 'primary_test', 'secondary_test');

-- Add guest user columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN user_type public.test_user_type NOT NULL DEFAULT 'real',
ADD COLUMN simulated_role public.krypton_role NULL,
ADD COLUMN expires_at timestamp with time zone NULL,
ADD COLUMN created_by_tl uuid NULL;

-- Add index for efficient guest user queries
CREATE INDEX idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX idx_profiles_expires_at ON public.profiles(expires_at) WHERE expires_at IS NOT NULL;

-- Create function to check if user is a guest (test user)
CREATE OR REPLACE FUNCTION public.is_guest_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND user_type IN ('primary_test', 'secondary_test')
  )
$$;

-- Create function to check if user is a primary test user
CREATE OR REPLACE FUNCTION public.is_primary_test_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND user_type = 'primary_test'
  )
$$;

-- Create function to get user's simulated role (for primary test users)
CREATE OR REPLACE FUNCTION public.get_simulated_role(_user_id uuid)
RETURNS public.krypton_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT simulated_role 
  FROM public.profiles 
  WHERE user_id = _user_id 
    AND user_type = 'primary_test'
  LIMIT 1
$$;

-- Create function to check if guest user session is expired
CREATE OR REPLACE FUNCTION public.is_guest_expired(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND user_type IN ('primary_test', 'secondary_test')
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
  )
$$;

-- Update RLS on grouping_sessions to restrict guest delete
DROP POLICY IF EXISTS "TL/VC can delete sessions" ON public.grouping_sessions;
CREATE POLICY "TL/VC can delete sessions (non-guest or own)"
ON public.grouping_sessions
FOR DELETE
USING (
  is_captain_or_vice(auth.uid()) 
  AND (
    NOT is_guest_user(auth.uid()) 
    OR created_by = auth.uid()
  )
);

-- Update RLS on profiles to allow TL to manage guest users
CREATE POLICY "TL can create guest user profiles"
ON public.profiles
FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) 
  OR (has_role(auth.uid(), 'team_captain') AND user_type IN ('primary_test', 'secondary_test'))
);

-- Allow TL to update guest user profiles
CREATE POLICY "TL can update guest user profiles"
ON public.profiles
FOR UPDATE
USING (
  (auth.uid() = user_id) 
  OR (has_role(auth.uid(), 'team_captain') AND user_type IN ('primary_test', 'secondary_test'))
);

-- Allow TL to delete guest user profiles
CREATE POLICY "TL can delete guest user profiles"
ON public.profiles
FOR DELETE
USING (
  has_role(auth.uid(), 'team_captain') 
  AND user_type IN ('primary_test', 'secondary_test')
);

-- Create table for guest user audit logs (separate from real logs)
CREATE TABLE public.guest_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  guest_user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on guest audit log
ALTER TABLE public.guest_audit_log ENABLE ROW LEVEL SECURITY;

-- Only TL can view guest audit logs
CREATE POLICY "TL can view guest audit logs"
ON public.guest_audit_log
FOR SELECT
USING (has_role(auth.uid(), 'team_captain'));

-- System can insert guest audit logs
CREATE POLICY "Insert guest audit logs"
ON public.guest_audit_log
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
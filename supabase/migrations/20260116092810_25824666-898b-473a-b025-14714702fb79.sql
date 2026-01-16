-- Add user_id column to registration_requests to link to created auth user
ALTER TABLE public.registration_requests 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Remove password_hash column since we no longer need it (password is in auth.users)
-- Keep it for now for backward compatibility, but it will be null for new registrations
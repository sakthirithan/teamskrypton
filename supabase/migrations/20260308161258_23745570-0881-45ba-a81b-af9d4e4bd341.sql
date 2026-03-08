
-- Add a custom_domain text column for user-created domains
ALTER TABLE public.member_skills ADD COLUMN custom_domain text DEFAULT NULL;

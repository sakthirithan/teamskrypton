ALTER TABLE public.skill_challenges ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.daily_study_items ADD COLUMN IF NOT EXISTS image_url text;
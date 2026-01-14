-- Add phone_number column to profiles table
ALTER TABLE public.profiles ADD COLUMN phone_number TEXT;

-- Add index for better querying
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone_number);

-- Leadership can update any profile's phone number
CREATE POLICY "Leadership can update phone numbers"
ON public.profiles
FOR UPDATE
USING (is_captain_or_vice(auth.uid()))
WITH CHECK (is_captain_or_vice(auth.uid()));
-- Create grouping_notes table for discussions
CREATE TABLE public.grouping_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.grouping_sessions(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  is_test BOOLEAN DEFAULT false
);

-- Create grouping_note_replies table
CREATE TABLE public.grouping_note_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.grouping_notes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_test BOOLEAN DEFAULT false
);

-- Enable RLS on notes
ALTER TABLE public.grouping_notes ENABLE ROW LEVEL SECURITY;

-- Enable RLS on replies
ALTER TABLE public.grouping_note_replies ENABLE ROW LEVEL SECURITY;

-- Notes policies: all authenticated users can view
CREATE POLICY "All authenticated can view notes"
ON public.grouping_notes
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- All authenticated users can create notes
CREATE POLICY "All authenticated can create notes"
ON public.grouping_notes
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Only creator can update their notes
CREATE POLICY "Creator can update own notes"
ON public.grouping_notes
FOR UPDATE
USING (auth.uid() = created_by);

-- Only creator can delete their notes
CREATE POLICY "Creator can delete own notes"
ON public.grouping_notes
FOR DELETE
USING (auth.uid() = created_by);

-- Reply policies: all authenticated can view
CREATE POLICY "All authenticated can view replies"
ON public.grouping_note_replies
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- All authenticated can create replies
CREATE POLICY "All authenticated can create replies"
ON public.grouping_note_replies
FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Only creator can update their replies
CREATE POLICY "Creator can update own replies"
ON public.grouping_note_replies
FOR UPDATE
USING (auth.uid() = created_by);

-- Only creator can delete their replies
CREATE POLICY "Creator can delete own replies"
ON public.grouping_note_replies
FOR DELETE
USING (auth.uid() = created_by);

-- Create trigger for auto-updating updated_at on replies
CREATE TRIGGER update_grouping_note_replies_updated_at
BEFORE UPDATE ON public.grouping_note_replies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to set expires_at on notes creation
CREATE OR REPLACE FUNCTION public.set_note_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  NEW.expires_at := NOW() + INTERVAL '48 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_grouping_note_expiry
BEFORE INSERT ON public.grouping_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_note_expiry();
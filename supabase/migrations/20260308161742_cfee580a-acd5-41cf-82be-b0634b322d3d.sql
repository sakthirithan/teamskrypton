
-- Table for GitHub/website links developed through skill learning
CREATE TABLE public.skill_dev_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_track_id uuid NOT NULL REFERENCES public.skill_tracks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL,
  url text NOT NULL,
  link_type text NOT NULL DEFAULT 'website',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_dev_links ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view
CREATE POLICY "View skill dev links"
ON public.skill_dev_links FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Users can add own links, leadership can add for anyone
CREATE POLICY "Create skill dev links"
ON public.skill_dev_links FOR INSERT
TO authenticated
WITH CHECK (
  (auth.uid() = user_id)
  OR is_leadership(auth.uid())
);

-- Users can delete own links, leadership can delete any
CREATE POLICY "Delete skill dev links"
ON public.skill_dev_links FOR DELETE
TO authenticated
USING (
  (auth.uid() = user_id)
  OR is_leadership(auth.uid())
);

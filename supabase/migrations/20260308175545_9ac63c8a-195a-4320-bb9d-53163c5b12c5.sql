
-- Add share_percentage and role_label to project_members
ALTER TABLE public.project_members 
  ADD COLUMN IF NOT EXISTS share_percentage integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS role_label text;

-- Only TL can update shares
CREATE POLICY "TL can update member shares"
ON public.project_members
FOR UPDATE
USING (
  has_role(auth.uid(), 'team_captain'::krypton_role)
)
WITH CHECK (
  has_role(auth.uid(), 'team_captain'::krypton_role)
);

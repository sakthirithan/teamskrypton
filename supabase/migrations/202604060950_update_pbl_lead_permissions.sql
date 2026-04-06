-- Update RLS for project lead permissions

-- Security definer function to check if a user is the designated lead for a project
CREATE OR REPLACE FUNCTION public.is_project_lead(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE project_id = _project_id
      AND user_id = _user_id
      AND role = 'lead'
  )
$$;

-- 1. Projects: Allow project lead to UPDATE
DROP POLICY IF EXISTS "Update projects" ON public.projects;
CREATE POLICY "Update projects" ON public.projects FOR UPDATE
  USING (is_leadership(auth.uid()) OR owner_id = auth.uid() OR is_project_lead(auth.uid(), id));

-- 2. Project Members: Allow project lead to manage members
DROP POLICY IF EXISTS "Leadership manages members" ON public.project_members;
CREATE POLICY "Leadership manages members" ON public.project_members FOR INSERT
  WITH CHECK (is_leadership(auth.uid()) OR is_project_lead(auth.uid(), project_id));

DROP POLICY IF EXISTS "Leadership updates members" ON public.project_members;
CREATE POLICY "Leadership updates members" ON public.project_members FOR UPDATE
  USING (is_leadership(auth.uid()) OR is_project_lead(auth.uid(), project_id));

DROP POLICY IF EXISTS "Leadership removes members" ON public.project_members;
CREATE POLICY "Leadership removes members" ON public.project_members FOR DELETE
  USING (is_leadership(auth.uid()) OR is_project_lead(auth.uid(), project_id));

-- 3. Milestones: Allow project lead to manage milestones
DROP POLICY IF EXISTS "Leadership creates milestones" ON public.milestones;
CREATE POLICY "Leadership creates milestones" ON public.milestones FOR INSERT
  WITH CHECK (is_leadership(auth.uid()) OR is_project_lead(auth.uid(), project_id));

DROP POLICY IF EXISTS "Leadership updates milestones" ON public.milestones;
CREATE POLICY "Leadership updates milestones" ON public.milestones FOR UPDATE
  USING (is_leadership(auth.uid()) OR is_project_lead(auth.uid(), project_id));

DROP POLICY IF EXISTS "Leadership deletes milestones" ON public.milestones;
CREATE POLICY "Leadership deletes milestones" ON public.milestones FOR DELETE
  USING (is_leadership(auth.uid()) OR is_project_lead(auth.uid(), project_id));

-- 4. Project Tasks: Allow project lead to manage tasks
DROP POLICY IF EXISTS "Create project tasks" ON public.project_tasks;
CREATE POLICY "Create project tasks" ON public.project_tasks FOR INSERT
  WITH CHECK (is_leadership(auth.uid()) OR auth.uid() = created_by OR is_project_lead(auth.uid(), project_id));

DROP POLICY IF EXISTS "Update project tasks" ON public.project_tasks;
CREATE POLICY "Update project tasks" ON public.project_tasks FOR UPDATE
  USING (is_leadership(auth.uid()) OR assigned_to = auth.uid() OR is_project_lead(auth.uid(), project_id));

DROP POLICY IF EXISTS "Delete project tasks" ON public.project_tasks;
CREATE POLICY "Delete project tasks" ON public.project_tasks FOR DELETE
  USING (is_leadership(auth.uid()) OR is_project_lead(auth.uid(), project_id));

-- 5. Project Documents: Allow project lead to manage documents
DROP POLICY IF EXISTS "Leadership manages documents" ON public.project_documents;
CREATE POLICY "Project lead manages documents" ON public.project_documents
  FOR ALL
  USING (is_leadership(auth.uid()) OR uploaded_by = auth.uid() OR is_project_lead(auth.uid(), project_id));

-- 6. Project Comments: Allow project lead to moderate comments
DROP POLICY IF EXISTS "Moderation for project lead" ON public.project_comments;
CREATE POLICY "Moderation for project lead" ON public.project_comments
  FOR DELETE
  USING (is_leadership(auth.uid()) OR user_id = auth.uid() OR is_project_lead(auth.uid(), project_id));

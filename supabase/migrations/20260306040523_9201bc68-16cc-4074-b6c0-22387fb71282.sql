
-- Project-Driven PBL Schema

-- Project status enum
CREATE TYPE public.project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'archived');

-- Milestone status enum  
CREATE TYPE public.milestone_status AS ENUM ('not_started', 'in_progress', 'completed', 'overdue');

-- Project task status enum
CREATE TYPE public.project_task_status AS ENUM ('todo', 'in_progress', 'review', 'done');

-- Priority enum
CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'critical');

-- ============ PROJECTS TABLE ============
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL,
  status project_status NOT NULL DEFAULT 'planning',
  priority priority_level NOT NULL DEFAULT 'medium',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  deadline DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_test BOOLEAN DEFAULT false
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Everyone can view non-test projects
CREATE POLICY "View projects" ON public.projects FOR SELECT
  USING (auth.uid() IS NOT NULL AND (is_test = false OR is_leadership(auth.uid())));

-- Leadership can create projects
CREATE POLICY "Leadership creates projects" ON public.projects FOR INSERT
  WITH CHECK (is_leadership(auth.uid()));

-- Leadership or owner can update
CREATE POLICY "Update projects" ON public.projects FOR UPDATE
  USING (is_leadership(auth.uid()) OR owner_id = auth.uid());

-- TL/VC can delete
CREATE POLICY "Delete projects" ON public.projects FOR DELETE
  USING (is_captain_or_vice(auth.uid()));

-- ============ PROJECT MEMBERS TABLE ============
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project members" ON public.project_members FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Leadership manages members" ON public.project_members FOR INSERT
  WITH CHECK (is_leadership(auth.uid()));

CREATE POLICY "Leadership updates members" ON public.project_members FOR UPDATE
  USING (is_leadership(auth.uid()));

CREATE POLICY "Leadership removes members" ON public.project_members FOR DELETE
  USING (is_leadership(auth.uid()));

-- ============ MILESTONES TABLE ============
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status milestone_status NOT NULL DEFAULT 'not_started',
  due_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View milestones" ON public.milestones FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Leadership creates milestones" ON public.milestones FOR INSERT
  WITH CHECK (is_leadership(auth.uid()));

CREATE POLICY "Leadership updates milestones" ON public.milestones FOR UPDATE
  USING (is_leadership(auth.uid()));

CREATE POLICY "Leadership deletes milestones" ON public.milestones FOR DELETE
  USING (is_leadership(auth.uid()));

-- ============ PROJECT TASKS TABLE ============
CREATE TABLE public.project_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  milestone_id UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID,
  status project_task_status NOT NULL DEFAULT 'todo',
  priority priority_level NOT NULL DEFAULT 'medium',
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project tasks" ON public.project_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Create project tasks" ON public.project_tasks FOR INSERT
  WITH CHECK (is_leadership(auth.uid()) OR auth.uid() = created_by);

CREATE POLICY "Update project tasks" ON public.project_tasks FOR UPDATE
  USING (is_leadership(auth.uid()) OR assigned_to = auth.uid());

CREATE POLICY "Delete project tasks" ON public.project_tasks FOR DELETE
  USING (is_leadership(auth.uid()));

-- ============ ACTIVITY LOG TABLE ============
CREATE TABLE public.project_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.project_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project activity" ON public.project_activity FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert project activity" ON public.project_activity FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============ TRIGGERS ============
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_tasks_updated_at BEFORE UPDATE ON public.project_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

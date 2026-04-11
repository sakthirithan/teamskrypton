-- Add assigned_members array column to global_todos
ALTER TABLE public.global_todos
ADD COLUMN IF NOT EXISTS assigned_members UUID[] DEFAULT '{}'::uuid[];

-- Drop existing global_todos RLS policies to redefine them
DROP POLICY IF EXISTS "Global todos are viewable by everyone" ON public.global_todos;
DROP POLICY IF EXISTS "Global todos can be created by auth users" ON public.global_todos;
DROP POLICY IF EXISTS "Global todos can be updated by creator" ON public.global_todos;
DROP POLICY IF EXISTS "Global todos can be deleted by creator or leadership" ON public.global_todos;
DROP POLICY IF EXISTS "View global_todos" ON public.global_todos;
DROP POLICY IF EXISTS "Insert global_todos" ON public.global_todos;
DROP POLICY IF EXISTS "Update global_todos" ON public.global_todos;
DROP POLICY IF EXISTS "Delete global_todos" ON public.global_todos;

-- Recreate policies for global_todos
CREATE POLICY "View global_todos" ON public.global_todos
FOR SELECT USING (
  auth.uid() IS NOT NULL
);

CREATE POLICY "Insert global_todos" ON public.global_todos
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- For Update/Delete, allow creator, assignee, leadership, or project lead
CREATE POLICY "Update global_todos" ON public.global_todos
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth.uid() = ANY(assigned_members) OR
  is_leadership(auth.uid()) OR
  (
    -- Check if auth is a project lead for ANY of the assigned members
    EXISTS (
      SELECT 1 FROM unnest(assigned_members) am
      WHERE is_lead_for_user(auth.uid(), am)
    )
  )
);

CREATE POLICY "Delete global_todos" ON public.global_todos
FOR DELETE USING (
  auth.uid() = created_by OR
  is_leadership(auth.uid()) OR
  (
    EXISTS (
      SELECT 1 FROM unnest(assigned_members) am
      WHERE is_lead_for_user(auth.uid(), am)
    )
  )
);

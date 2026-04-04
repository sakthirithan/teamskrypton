
-- Challenge assignments junction table
CREATE TABLE public.challenge_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.skill_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE public.challenge_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View challenge assignments" ON public.challenge_assignments
  FOR SELECT TO public USING (auth.uid() IS NOT NULL);

CREATE POLICY "Leadership assigns challenges" ON public.challenge_assignments
  FOR INSERT TO public WITH CHECK (is_leadership(auth.uid()));

CREATE POLICY "Leadership deletes assignments" ON public.challenge_assignments
  FOR DELETE TO public USING (is_leadership(auth.uid()));

-- Global To-Do list
CREATE TABLE public.global_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  mode text NOT NULL DEFAULT 'all', -- 'grouping', 'pbl', 'all'
  created_by uuid NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  session_id uuid REFERENCES public.grouping_sessions(id),
  parent_id uuid REFERENCES public.global_todos(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.global_todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View todos" ON public.global_todos
  FOR SELECT TO public USING (auth.uid() IS NOT NULL);

CREATE POLICY "Leadership creates global todos" ON public.global_todos
  FOR INSERT TO public WITH CHECK (
    (is_global = true AND is_leadership(auth.uid())) OR
    (is_global = false AND auth.uid() = created_by)
  );

CREATE POLICY "Update todos" ON public.global_todos
  FOR UPDATE TO public USING (
    is_leadership(auth.uid()) OR auth.uid() = created_by
  );

CREATE POLICY "Delete todos" ON public.global_todos
  FOR DELETE TO public USING (
    is_leadership(auth.uid()) OR auth.uid() = created_by
  );

-- To-Do completions (track who completed what)
CREATE TABLE public.global_todo_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id uuid NOT NULL REFERENCES public.global_todos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(todo_id, user_id)
);

ALTER TABLE public.global_todo_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View completions" ON public.global_todo_completions
  FOR SELECT TO public USING (auth.uid() IS NOT NULL);

CREATE POLICY "Mark own completion" ON public.global_todo_completions
  FOR INSERT TO public WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Unmark own completion" ON public.global_todo_completions
  FOR DELETE TO public USING (auth.uid() = user_id);

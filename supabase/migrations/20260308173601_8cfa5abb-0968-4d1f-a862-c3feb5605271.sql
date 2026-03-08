
-- Project Comments (threaded)
CREATE TABLE public.project_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.project_tasks(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project comments" ON public.project_comments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Create project comments" ON public.project_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own comments" ON public.project_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete comments" ON public.project_comments FOR DELETE USING (auth.uid() = user_id OR is_leadership(auth.uid()));

-- Project Documents & Links
CREATE TABLE public.project_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  url text NOT NULL,
  doc_type text NOT NULL DEFAULT 'link',
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View project documents" ON public.project_documents FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Create project documents" ON public.project_documents FOR INSERT WITH CHECK (auth.uid() = uploaded_by);
CREATE POLICY "Delete project documents" ON public.project_documents FOR DELETE USING (auth.uid() = uploaded_by OR is_leadership(auth.uid()));
CREATE POLICY "Update project documents" ON public.project_documents FOR UPDATE USING (auth.uid() = uploaded_by OR is_leadership(auth.uid()));

-- Project Notifications
CREATE TABLE public.project_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own notifications" ON public.project_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Create notifications" ON public.project_notifications FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Update own notifications" ON public.project_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own notifications" ON public.project_notifications FOR DELETE USING (auth.uid() = user_id);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_notifications;

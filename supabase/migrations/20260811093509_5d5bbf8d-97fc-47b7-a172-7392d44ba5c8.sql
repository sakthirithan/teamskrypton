
-- 1. Incharge appointments
CREATE TABLE public.incharge_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  position text NOT NULL,
  responsibilities text,
  session_id uuid REFERENCES public.grouping_sessions(id) ON DELETE SET NULL,
  appointed_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incharge_appointments TO authenticated;
GRANT ALL ON public.incharge_appointments TO service_role;
ALTER TABLE public.incharge_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view incharge appointments"
  ON public.incharge_appointments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Captains manage incharge appointments"
  ON public.incharge_appointments FOR ALL TO authenticated
  USING (public.is_captain_or_vice(auth.uid()))
  WITH CHECK (public.is_captain_or_vice(auth.uid()));

CREATE TRIGGER incharge_appointments_updated_at
  BEFORE UPDATE ON public.incharge_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helper: is this user an active incharge?
CREATE OR REPLACE FUNCTION public.is_incharge(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.incharge_appointments
    WHERE user_id = _user_id AND is_active = true
  )
$$;

-- 2. Schedule activities
CREATE TABLE public.schedule_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  activity_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  category text NOT NULL DEFAULT 'general',
  location text,
  status text NOT NULL DEFAULT 'proposed',
  sort_order integer NOT NULL DEFAULT 0,
  appointment_id uuid REFERENCES public.incharge_appointments(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.grouping_sessions(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  finalized_by uuid,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_activities TO authenticated;
GRANT ALL ON public.schedule_activities TO service_role;
ALTER TABLE public.schedule_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view activities"
  ON public.schedule_activities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Incharges create own activities"
  ON public.schedule_activities FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.is_incharge(auth.uid()) OR public.is_leadership(auth.uid())));

CREATE POLICY "Owner or leadership update activities"
  ON public.schedule_activities FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_leadership(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_leadership(auth.uid()));

CREATE POLICY "Owner or leadership delete activities"
  ON public.schedule_activities FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_leadership(auth.uid()));

CREATE TRIGGER schedule_activities_updated_at
  BEFORE UPDATE ON public.schedule_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_schedule_activities_date ON public.schedule_activities(activity_date);

-- 3. Activity members
CREATE TABLE public.schedule_activity_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.schedule_activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_activity_members TO authenticated;
GRANT ALL ON public.schedule_activity_members TO service_role;
ALTER TABLE public.schedule_activity_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view activity members"
  ON public.schedule_activity_members FOR SELECT TO authenticated USING (true);

CREATE POLICY "Owner or leadership manage activity members"
  ON public.schedule_activity_members FOR ALL TO authenticated
  USING (
    public.is_leadership(auth.uid())
    OR EXISTS (SELECT 1 FROM public.schedule_activities a WHERE a.id = activity_id AND a.created_by = auth.uid())
  )
  WITH CHECK (
    public.is_leadership(auth.uid())
    OR EXISTS (SELECT 1 FROM public.schedule_activities a WHERE a.id = activity_id AND a.created_by = auth.uid())
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.incharge_appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_activity_members;

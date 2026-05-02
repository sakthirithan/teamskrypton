-- Add DELETE policy on task_alerts
CREATE POLICY "Leadership and recipients can delete task alerts"
ON public.task_alerts
FOR DELETE
USING (
  is_leadership(auth.uid())
  OR task_id IN (SELECT id FROM public.tasks WHERE assigned_to = auth.uid())
);

-- Fix mutable search_path on SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (
    user_id, full_name, email, department, user_type, current_status, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    NEW.raw_user_meta_data->>'department',
    'member',
    'idle',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_login_on_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM user_login_activity WHERE user_id = OLD.id;
  RETURN OLD;
END;
$function$;
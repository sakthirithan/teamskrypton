
-- ============ Part 1: Profile disable/enable columns ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_mode text,
  ADD COLUMN IF NOT EXISTS disabled_reason text,
  ADD COLUMN IF NOT EXISTS disabled_by uuid,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_is_disabled ON public.profiles(is_disabled, disabled_until);

-- ============ Part 2: Audit history table ============
CREATE TABLE IF NOT EXISTS public.profile_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_user_id uuid NOT NULL,
  action text NOT NULL, -- 'disabled' | 'enabled' | 'mode_changed' | 'extended' | 'auto_restored'
  mode text,             -- 'hidden' | 'read_only' | null (on enable)
  reason text,
  disabled_until timestamptz,
  performed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profile_status_history TO authenticated;
GRANT ALL ON public.profile_status_history TO service_role;
ALTER TABLE public.profile_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Captains view history" ON public.profile_status_history;
CREATE POLICY "Captains view history"
  ON public.profile_status_history FOR SELECT
  TO authenticated
  USING (public.is_captain_or_vice(auth.uid()));

-- ============ Part 3: Active check helper ============
CREATE OR REPLACE FUNCTION public.is_profile_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND is_disabled = true
      AND (disabled_until IS NULL OR disabled_until > now())
  );
$$;

-- ============ Part 4: Read-only mode check (for hooks) ============
CREATE OR REPLACE FUNCTION public.get_disabled_mode(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT disabled_mode FROM public.profiles
  WHERE user_id = _user_id
    AND is_disabled = true
    AND (disabled_until IS NULL OR disabled_until > now())
  LIMIT 1;
$$;

-- ============ Part 5: Toggle RPC ============
CREATE OR REPLACE FUNCTION public.toggle_profile_status(
  _target_user_id uuid,
  _disable boolean,
  _mode text DEFAULT NULL,
  _reason text DEFAULT NULL,
  _disabled_until timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _caller_role krypton_role;
  _target_role krypton_role;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _caller = _target_user_id THEN
    RAISE EXCEPTION 'You cannot disable your own profile';
  END IF;

  SELECT role INTO _caller_role FROM public.user_roles WHERE user_id = _caller LIMIT 1;
  SELECT role INTO _target_role FROM public.user_roles WHERE user_id = _target_user_id LIMIT 1;

  IF _caller_role NOT IN ('team_captain', 'vice_captain') THEN
    RAISE EXCEPTION 'Only Team Captains and Vice Captains can toggle profile status';
  END IF;

  -- Team Captain cannot be disabled by anyone (only enabled). VC cannot disable TC.
  IF _target_role = 'team_captain' AND _disable = true THEN
    RAISE EXCEPTION 'The Team Captain cannot be disabled';
  END IF;

  IF _disable = true THEN
    IF _mode NOT IN ('hidden', 'read_only') THEN
      RAISE EXCEPTION 'Invalid mode: must be hidden or read_only';
    END IF;

    UPDATE public.profiles
    SET is_disabled = true,
        disabled_mode = _mode,
        disabled_reason = _reason,
        disabled_by = _caller,
        disabled_at = now(),
        disabled_until = _disabled_until,
        updated_at = now()
    WHERE user_id = _target_user_id;

    INSERT INTO public.profile_status_history
      (profile_user_id, action, mode, reason, disabled_until, performed_by)
    VALUES
      (_target_user_id, 'disabled', _mode, _reason, _disabled_until, _caller);
  ELSE
    UPDATE public.profiles
    SET is_disabled = false,
        disabled_mode = NULL,
        disabled_reason = NULL,
        disabled_by = NULL,
        disabled_at = NULL,
        disabled_until = NULL,
        updated_at = now()
    WHERE user_id = _target_user_id;

    INSERT INTO public.profile_status_history
      (profile_user_id, action, mode, reason, disabled_until, performed_by)
    VALUES
      (_target_user_id, 'enabled', NULL, _reason, NULL, _caller);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_profile_status(uuid, boolean, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_profile_status(uuid, boolean, text, text, timestamptz) TO authenticated;

-- ============ Part 6: Remove GP Redeem / Marketplace ============
DROP TABLE IF EXISTS public.marketplace_reviews CASCADE;
DROP TABLE IF EXISTS public.marketplace_wishlist CASCADE;
DROP TABLE IF EXISTS public.marketplace_access_log CASCADE;
DROP TABLE IF EXISTS public.marketplace_purchases CASCADE;
DROP TABLE IF EXISTS public.marketplace_materials CASCADE;
DROP TABLE IF EXISTS public.marketplace_treasury CASCADE;

DROP FUNCTION IF EXISTS public.has_active_rental(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.recompute_material_rating() CASCADE;
DROP FUNCTION IF EXISTS public.marketplace_materials_tsv() CASCADE;

DROP TYPE IF EXISTS public.marketplace_material_type CASCADE;
DROP TYPE IF EXISTS public.marketplace_material_status CASCADE;
DROP TYPE IF EXISTS public.marketplace_purchase_status CASCADE;

-- Google Sheet Configuration table
CREATE TABLE public.google_sheet_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id text NOT NULL,
  sheet_name text NOT NULL DEFAULT 'Sheet1',
  sheet_url text NOT NULL,
  tracked_columns text[] NOT NULL DEFAULT '{}',
  row_logic_type text NOT NULL DEFAULT 'match_username' CHECK (row_logic_type IN ('match_username', 'fixed_row', 'last_row')),
  username_column text,
  fixed_row_number integer,
  refresh_interval integer NOT NULL DEFAULT 15,
  enabled boolean NOT NULL DEFAULT true,
  configured_by uuid NOT NULL,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.google_sheet_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sheet configs"
ON public.google_sheet_configs FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Leadership can create sheet configs"
ON public.google_sheet_configs FOR INSERT
TO authenticated
WITH CHECK (is_leadership(auth.uid()));

CREATE POLICY "Leadership can update sheet configs"
ON public.google_sheet_configs FOR UPDATE
TO authenticated
USING (is_leadership(auth.uid()));

CREATE POLICY "TL VC can delete sheet configs"
ON public.google_sheet_configs FOR DELETE
TO authenticated
USING (is_captain_or_vice(auth.uid()));

-- Cached sheet data table
CREATE TABLE public.google_sheet_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid NOT NULL REFERENCES public.google_sheet_configs(id) ON DELETE CASCADE,
  user_id uuid,
  column_name text NOT NULL,
  cell_value text,
  row_index integer,
  fetched_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.google_sheet_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sheet cache"
ON public.google_sheet_cache FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Leadership can insert sheet cache"
ON public.google_sheet_cache FOR INSERT
TO authenticated
WITH CHECK (is_leadership(auth.uid()));

CREATE POLICY "Leadership can update sheet cache"
ON public.google_sheet_cache FOR UPDATE
TO authenticated
USING (is_leadership(auth.uid()));

CREATE POLICY "Leadership can delete sheet cache"
ON public.google_sheet_cache FOR DELETE
TO authenticated
USING (is_leadership(auth.uid()));
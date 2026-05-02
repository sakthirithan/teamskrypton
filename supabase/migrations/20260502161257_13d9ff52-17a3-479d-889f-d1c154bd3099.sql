
-- Enums
CREATE TYPE public.marketplace_material_type AS ENUM ('pdf','drive','youtube','github','url','image');
CREATE TYPE public.marketplace_material_status AS ENUM ('active','paused','removed');
CREATE TYPE public.marketplace_purchase_status AS ENUM ('active','expired','refunded');

-- MATERIALS
CREATE TABLE public.marketplace_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  material_type public.marketplace_material_type NOT NULL,
  source_url TEXT NOT NULL,
  thumbnail_url TEXT,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  domain TEXT,
  price_per_day INTEGER NOT NULL DEFAULT 5 CHECK (price_per_day >= 0),
  min_days INTEGER NOT NULL DEFAULT 1 CHECK (min_days >= 1),
  max_days INTEGER NOT NULL DEFAULT 30 CHECK (max_days >= min_days),
  discount_pct_7d INTEGER NOT NULL DEFAULT 0 CHECK (discount_pct_7d BETWEEN 0 AND 80),
  discount_pct_30d INTEGER NOT NULL DEFAULT 0 CHECK (discount_pct_30d BETWEEN 0 AND 80),
  status public.marketplace_material_status NOT NULL DEFAULT 'active',
  view_count INTEGER NOT NULL DEFAULT 0,
  purchase_count INTEGER NOT NULL DEFAULT 0,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  featured_until TIMESTAMPTZ,
  search_vec tsvector,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_materials_uploader ON public.marketplace_materials(uploader_id);
CREATE INDEX idx_marketplace_materials_status ON public.marketplace_materials(status);
CREATE INDEX idx_marketplace_materials_search ON public.marketplace_materials USING GIN (search_vec);
CREATE INDEX idx_marketplace_materials_keywords ON public.marketplace_materials USING GIN (keywords);

-- search_vec trigger
CREATE OR REPLACE FUNCTION public.marketplace_materials_tsv()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.search_vec :=
    setweight(to_tsvector('simple', coalesce(NEW.title,'')), 'A') ||
    setweight(to_tsvector('simple', array_to_string(NEW.keywords,' ')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description,'')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.domain,'')), 'D');
  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_marketplace_materials_tsv
BEFORE INSERT OR UPDATE ON public.marketplace_materials
FOR EACH ROW EXECUTE FUNCTION public.marketplace_materials_tsv();

ALTER TABLE public.marketplace_materials ENABLE ROW LEVEL SECURITY;

-- Anyone authed views non-removed materials (raw URL exposed, but app uses view; acceptable since URL only useful with active rental + buyers can subscribe directly through app anyway). To keep URL hidden, restrict SELECT of source_url via column-level policy alternative: limit SELECT to uploader/leadership and expose the rest via a public view.
CREATE POLICY "View own or leadership full material"
ON public.marketplace_materials FOR SELECT
USING (uploader_id = auth.uid() OR is_leadership(auth.uid()));

CREATE POLICY "Uploader inserts material"
ON public.marketplace_materials FOR INSERT
WITH CHECK (uploader_id = auth.uid());

CREATE POLICY "Uploader/leadership update material"
ON public.marketplace_materials FOR UPDATE
USING (uploader_id = auth.uid() OR is_leadership(auth.uid()));

CREATE POLICY "Uploader/leadership delete material"
ON public.marketplace_materials FOR DELETE
USING (uploader_id = auth.uid() OR is_leadership(auth.uid()));

-- Public-safe view (no source_url)
CREATE VIEW public.marketplace_materials_public AS
SELECT
  id, uploader_id, title, description, material_type, thumbnail_url,
  keywords, domain, price_per_day, min_days, max_days,
  discount_pct_7d, discount_pct_30d, status,
  view_count, purchase_count, rating_sum, rating_count, featured_until,
  created_at, updated_at
FROM public.marketplace_materials
WHERE status <> 'removed';

GRANT SELECT ON public.marketplace_materials_public TO anon, authenticated;

-- PURCHASES
CREATE TABLE public.marketplace_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.marketplace_materials(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  uploader_id UUID NOT NULL,
  days_purchased INTEGER NOT NULL CHECK (days_purchased >= 1),
  gp_paid INTEGER NOT NULL CHECK (gp_paid >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  status public.marketplace_purchase_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mp_purchases_buyer ON public.marketplace_purchases(buyer_id);
CREATE INDEX idx_mp_purchases_material ON public.marketplace_purchases(material_id);
CREATE UNIQUE INDEX uniq_active_rental ON public.marketplace_purchases(material_id, buyer_id) WHERE status = 'active';

ALTER TABLE public.marketplace_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own/uploader/leadership purchases"
ON public.marketplace_purchases FOR SELECT
USING (buyer_id = auth.uid() OR uploader_id = auth.uid() OR is_leadership(auth.uid()));

-- Inserts/updates only via edge function (service role bypasses RLS); no public insert policy needed.

-- REVIEWS
CREATE TABLE public.marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.marketplace_materials(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (material_id, buyer_id)
);
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View reviews"
ON public.marketplace_reviews FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Insert review if rented"
ON public.marketplace_reviews FOR INSERT
WITH CHECK (
  auth.uid() = buyer_id AND EXISTS (
    SELECT 1 FROM public.marketplace_purchases p
    WHERE p.material_id = marketplace_reviews.material_id
      AND p.buyer_id = auth.uid()
  )
);

CREATE POLICY "Update own review"
ON public.marketplace_reviews FOR UPDATE
USING (auth.uid() = buyer_id);

CREATE POLICY "Delete own review or leadership"
ON public.marketplace_reviews FOR DELETE
USING (auth.uid() = buyer_id OR is_leadership(auth.uid()));

-- TREASURY (single row)
CREATE TABLE public.marketplace_treasury (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  balance INTEGER NOT NULL DEFAULT 0,
  total_collected INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.marketplace_treasury (id, balance, total_collected) VALUES (1, 0, 0);
ALTER TABLE public.marketplace_treasury ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leadership views treasury"
ON public.marketplace_treasury FOR SELECT
USING (is_leadership(auth.uid()));

-- ACCESS LOG
CREATE TABLE public.marketplace_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.marketplace_materials(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mp_log_material ON public.marketplace_access_log(material_id);
ALTER TABLE public.marketplace_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert own log"
ON public.marketplace_access_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "View own/uploader/leadership log"
ON public.marketplace_access_log FOR SELECT
USING (
  user_id = auth.uid()
  OR is_leadership(auth.uid())
  OR EXISTS (SELECT 1 FROM public.marketplace_materials m WHERE m.id = material_id AND m.uploader_id = auth.uid())
);

-- Helper: is_active_renter
CREATE OR REPLACE FUNCTION public.has_active_rental(_user_id uuid, _material_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.marketplace_purchases
    WHERE buyer_id = _user_id AND material_id = _material_id
      AND status = 'active' AND expires_at > now()
  ) OR EXISTS (
    SELECT 1 FROM public.marketplace_materials
    WHERE id = _material_id AND uploader_id = _user_id
  );
$$;

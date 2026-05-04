
-- Trigger to recompute aggregate ratings on review changes
CREATE OR REPLACE FUNCTION public.recompute_material_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_id uuid := COALESCE(NEW.material_id, OLD.material_id);
  s integer;
  c integer;
BEGIN
  SELECT COALESCE(SUM(rating), 0), COUNT(*) INTO s, c
  FROM public.marketplace_reviews
  WHERE material_id = target_id;
  UPDATE public.marketplace_materials
  SET rating_sum = s, rating_count = c, updated_at = now()
  WHERE id = target_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_material_rating_ins ON public.marketplace_reviews;
DROP TRIGGER IF EXISTS trg_recompute_material_rating_upd ON public.marketplace_reviews;
DROP TRIGGER IF EXISTS trg_recompute_material_rating_del ON public.marketplace_reviews;

CREATE TRIGGER trg_recompute_material_rating_ins
AFTER INSERT ON public.marketplace_reviews
FOR EACH ROW EXECUTE FUNCTION public.recompute_material_rating();

CREATE TRIGGER trg_recompute_material_rating_upd
AFTER UPDATE ON public.marketplace_reviews
FOR EACH ROW EXECUTE FUNCTION public.recompute_material_rating();

CREATE TRIGGER trg_recompute_material_rating_del
AFTER DELETE ON public.marketplace_reviews
FOR EACH ROW EXECUTE FUNCTION public.recompute_material_rating();

-- Helpful indexes for sorting/browse
CREATE INDEX IF NOT EXISTS idx_marketplace_materials_status_created
  ON public.marketplace_materials (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_materials_purchase_count
  ON public.marketplace_materials (purchase_count DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_materials_price
  ON public.marketplace_materials (price_per_day);

-- One review per buyer per material
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_reviews_unique_buyer_material'
  ) THEN
    ALTER TABLE public.marketplace_reviews
      ADD CONSTRAINT marketplace_reviews_unique_buyer_material UNIQUE (material_id, buyer_id);
  END IF;
END $$;

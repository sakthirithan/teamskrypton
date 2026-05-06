-- 1. Public bucket for material thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketplace-thumbnails', 'marketplace-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Marketplace thumbnails are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'marketplace-thumbnails');

CREATE POLICY "Users can upload their own marketplace thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'marketplace-thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own marketplace thumbnails"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'marketplace-thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own marketplace thumbnails"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'marketplace-thumbnails'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 2. Wishlist
CREATE TABLE public.marketplace_wishlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  material_id uuid NOT NULL REFERENCES public.marketplace_materials(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, material_id)
);

ALTER TABLE public.marketplace_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own wishlist"
ON public.marketplace_wishlist FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users add to their own wishlist"
ON public.marketplace_wishlist FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users remove from their own wishlist"
ON public.marketplace_wishlist FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX idx_wishlist_user ON public.marketplace_wishlist(user_id, created_at DESC);

-- 3. Trending index
CREATE INDEX IF NOT EXISTS idx_purchases_created_at
ON public.marketplace_purchases(created_at DESC);
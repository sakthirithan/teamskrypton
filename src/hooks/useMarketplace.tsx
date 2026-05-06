import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type MaterialType = 'pdf' | 'drive' | 'youtube' | 'github' | 'url' | 'image';
export type MaterialStatus = 'active' | 'paused' | 'removed';

export interface MarketplaceMaterial {
  id: string;
  uploader_id: string;
  title: string;
  description: string | null;
  material_type: MaterialType;
  thumbnail_url: string | null;
  keywords: string[];
  domain: string | null;
  price_per_day: number;
  min_days: number;
  max_days: number;
  discount_pct_7d: number;
  discount_pct_30d: number;
  status: MaterialStatus;
  view_count: number;
  purchase_count: number;
  rating_sum: number;
  rating_count: number;
  featured_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketplacePurchase {
  id: string;
  material_id: string;
  buyer_id: string;
  uploader_id: string;
  days_purchased: number;
  gp_paid: number;
  expires_at: string;
  status: 'active' | 'expired' | 'refunded';
  created_at: string;
}

export function detectMaterialType(url: string): MaterialType {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase();
    const p = u.pathname.toLowerCase();
    if (h.includes('drive.google.com')) return 'drive';
    if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube';
    if (h.includes('github.com')) return 'github';
    if (p.endsWith('.pdf')) return 'pdf';
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/.test(p)) return 'image';
    return 'url';
  } catch {
    return 'url';
  }
}

export function useMarketplace(searchQuery?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const materials = useQuery({
    queryKey: ['marketplace-materials', searchQuery],
    queryFn: async () => {
      let q = supabase
        .from('marketplace_materials_public' as any)
        .select('*')
        .eq('status', 'active')
        .order('featured_until', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (searchQuery && searchQuery.trim()) {
        const term = `%${searchQuery.trim()}%`;
        q = q.or(`title.ilike.${term},description.ilike.${term}`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as MarketplaceMaterial[];
    },
    enabled: !!user,
  });

  const myUploads = useQuery({
    queryKey: ['marketplace-my-uploads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_materials' as any)
        .select('*')
        .eq('uploader_id', user!.id)
        .neq('status', 'removed')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MarketplaceMaterial[];
    },
    enabled: !!user,
  });

  const myLibrary = useQuery({
    queryKey: ['marketplace-my-library', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_purchases' as any)
        .select('*')
        .eq('buyer_id', user!.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MarketplacePurchase[];
    },
    enabled: !!user,
  });

  const createMaterial = useMutation({
    mutationFn: async (m: Partial<MarketplaceMaterial> & { source_url: string }) => {
      const { error } = await supabase.from('marketplace_materials' as any).insert({
        uploader_id: user!.id,
        title: m.title,
        description: m.description ?? null,
        material_type: m.material_type ?? detectMaterialType(m.source_url),
        source_url: m.source_url,
        keywords: m.keywords ?? [],
        domain: m.domain ?? null,
        price_per_day: m.price_per_day ?? 5,
        min_days: m.min_days ?? 1,
        max_days: m.max_days ?? 30,
        discount_pct_7d: m.discount_pct_7d ?? 0,
        discount_pct_30d: m.discount_pct_30d ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-my-uploads'] });
      qc.invalidateQueries({ queryKey: ['marketplace-materials'] });
      toast({ title: 'Material published!' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Upload failed', description: e.message }),
  });

  const updateMaterial = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<MarketplaceMaterial> & { id: string }) => {
      const { error } = await supabase.from('marketplace_materials' as any).update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-my-uploads'] });
      qc.invalidateQueries({ queryKey: ['marketplace-materials'] });
    },
  });

  const removeMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketplace_materials' as any).update({ status: 'removed' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-my-uploads'] });
      qc.invalidateQueries({ queryKey: ['marketplace-materials'] });
      toast({ title: 'Material removed' });
    },
  });

  const purchase = useMutation({
    mutationFn: async ({ materialId, days }: { materialId: string; days: number }) => {
      const { data, error } = await supabase.functions.invoke('marketplace-purchase', {
        body: { materialId, days },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-my-library'] });
      qc.invalidateQueries({ queryKey: ['user-points'] });
      qc.invalidateQueries({ queryKey: ['marketplace-materials'] });
      toast({ title: '🎉 Rental activated!' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Purchase failed', description: e.message }),
  });

  const accessMaterial = async (materialId: string, action: 'view' | 'external_open' = 'view') => {
    const { data, error } = await supabase.functions.invoke('marketplace-access', {
      body: { materialId, action },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as { source_url: string; material_type: MaterialType; title: string; expires_at: string | null };
  };

  const openExternal = async (materialId: string) => {
    const d = await accessMaterial(materialId, 'external_open');
    window.open(d.source_url, '_blank', 'noopener,noreferrer');
    return d;
  };

  const suggestMeta = async (url: string) => {
    const { data, error } = await supabase.functions.invoke('marketplace-suggest-meta', {
      body: { url },
    });
    if (error) throw error;
    return data as { title: string; description: string; keywords: string[] };
  };

  // Reviews
  const useMaterialReviews = (materialId: string | null) =>
    useQuery({
      queryKey: ['marketplace-reviews', materialId],
      queryFn: async () => {
        if (!materialId) return [];
        const { data, error } = await supabase
          .from('marketplace_reviews' as any)
          .select('id, buyer_id, rating, comment, created_at')
          .eq('material_id', materialId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data as any[];
      },
      enabled: !!materialId,
    });

  const submitReview = useMutation({
    mutationFn: async ({ materialId, rating, comment }: { materialId: string; rating: number; comment?: string }) => {
      const { error } = await supabase.from('marketplace_reviews' as any).upsert(
        { material_id: materialId, buyer_id: user!.id, rating, comment: comment ?? null },
        { onConflict: 'material_id,buyer_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['marketplace-reviews', vars.materialId] });
      qc.invalidateQueries({ queryKey: ['marketplace-materials'] });
      toast({ title: 'Thanks for your review!' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Could not submit review', description: e.message }),
  });

  // Wishlist
  const wishlist = useQuery({
    queryKey: ['marketplace-wishlist', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_wishlist' as any)
        .select('material_id')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data || []).map((r: any) => r.material_id as string);
    },
    enabled: !!user,
  });

  const toggleWishlist = useMutation({
    mutationFn: async (materialId: string) => {
      const isSaved = (wishlist.data || []).includes(materialId);
      if (isSaved) {
        const { error } = await supabase
          .from('marketplace_wishlist' as any)
          .delete()
          .eq('user_id', user!.id)
          .eq('material_id', materialId);
        if (error) throw error;
        return 'removed' as const;
      }
      const { error } = await supabase
        .from('marketplace_wishlist' as any)
        .insert({ user_id: user!.id, material_id: materialId });
      if (error) throw error;
      return 'added' as const;
    },
    onSuccess: (action) => {
      qc.invalidateQueries({ queryKey: ['marketplace-wishlist'] });
      toast({ title: action === 'added' ? '❤️ Saved to wishlist' : 'Removed from wishlist' });
    },
  });

  // Trending: rentals in the last 7 days, grouped by material
  const trending = useQuery({
    queryKey: ['marketplace-trending'],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('marketplace_purchases' as any)
        .select('material_id')
        .gte('created_at', since);
      if (error) throw error;
      const counts = new Map<string, number>();
      (data || []).forEach((r: any) => counts.set(r.material_id, (counts.get(r.material_id) || 0) + 1));
      return counts;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const hardDeleteMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase
        .from('marketplace_purchases' as any)
        .select('id', { count: 'exact', head: true })
        .eq('material_id', id);
      if ((count ?? 0) > 0) throw new Error('Has rental history — use Remove from listing instead.');
      const { error } = await supabase.from('marketplace_materials' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketplace-my-uploads'] });
      qc.invalidateQueries({ queryKey: ['marketplace-materials'] });
      toast({ title: 'Material permanently deleted' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Hard delete blocked', description: e.message }),
  });

  return {
    materials: materials.data || [],
    isLoading: materials.isLoading,
    myUploads: myUploads.data || [],
    myLibrary: myLibrary.data || [],
    createMaterial,
    updateMaterial,
    removeMaterial,
    hardDeleteMaterial,
    purchase,
    accessMaterial,
    openExternal,
    suggestMeta,
    useMaterialReviews,
    submitReview,
  };
}

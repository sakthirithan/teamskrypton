import { useMemo, useState } from 'react';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Coins, Plus, Search, Library, Upload as UploadIcon, TrendingUp, Sparkles, Heart, Flame } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserPoints } from '@/hooks/useUserPoints';
import { useMarketplace, type MarketplaceMaterial } from '@/hooks/useMarketplace';
import { MaterialCard } from '@/components/marketplace/MaterialCard';
import { UploadMaterialDialog } from '@/components/marketplace/UploadMaterialDialog';
import { PurchaseDialog } from '@/components/marketplace/PurchaseDialog';
import { MaterialViewer } from '@/components/marketplace/MaterialViewer';
import { ReviewDialog } from '@/components/marketplace/ReviewDialog';
import { DeleteUploadDialog } from '@/components/marketplace/DeleteUploadDialog';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

type SortMode = 'newest' | 'popular' | 'rating' | 'cheap' | 'featured';

export default function GroupingMarketplace() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { getUserPoints } = useUserPoints();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceMaterial | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [rentTarget, setRentTarget] = useState<MarketplaceMaterial | null>(null);
  const [reviewTarget, setReviewTarget] = useState<MarketplaceMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MarketplaceMaterial | null>(null);

  const {
    materials, isLoading, myUploads, myLibrary, updateMaterial, openExternal,
    wishlist, toggleWishlist, trending,
  } = useMarketplace(search);
  const balance = user ? getUserPoints(user.id) : 0;

  const filtered = useMemo(() => {
    let list = filterType === 'all' ? materials : materials.filter((m) => m.material_type === filterType);
    list = [...list];
    switch (sort) {
      case 'popular':
        list.sort((a, b) => b.purchase_count - a.purchase_count); break;
      case 'rating':
        list.sort((a, b) => {
          const ar = a.rating_count ? a.rating_sum / a.rating_count : 0;
          const br = b.rating_count ? b.rating_sum / b.rating_count : 0;
          return br - ar;
        }); break;
      case 'cheap':
        list.sort((a, b) => a.price_per_day - b.price_per_day); break;
      case 'featured':
        list.sort((a, b) => {
          const af = a.featured_until && new Date(a.featured_until) > new Date() ? 1 : 0;
          const bf = b.featured_until && new Date(b.featured_until) > new Date() ? 1 : 0;
          return bf - af;
        }); break;
      case 'newest':
      default:
        list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    }
    return list;
  }, [materials, filterType, sort]);

  const libraryMaterialMap = useMemo(() => {
    const map = new Map<string, MarketplaceMaterial>();
    materials.forEach((m) => map.set(m.id, m));
    myUploads.forEach((m) => map.set(m.id, m));
    return map;
  }, [materials, myUploads]);

  const accessibleIds = useMemo(() => new Set(myLibrary.map((p) => p.material_id)), [myLibrary]);
  const wishlistSet = useMemo(() => new Set(wishlist), [wishlist]);

  const domains = useMemo(() => {
    const d = new Set<string>();
    materials.forEach((m) => m.domain && d.add(m.domain));
    return Array.from(d).slice(0, 12);
  }, [materials]);

  const topThisWeek = useMemo(() => {
    return [...materials]
      .map((m) => ({ m, score: trending.get(m.id) || 0 }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.m);
  }, [materials, trending]);

  const wishlistMaterials = useMemo(
    () => materials.filter((m) => wishlistSet.has(m.id)),
    [materials, wishlistSet],
  );

  const handleOpenExternal = async (id: string) => {
    try { await openExternal(id); }
    catch (e: any) { toast({ variant: 'destructive', title: 'Cannot open', description: e.message }); }
  };

  return (
    <GroupingLayout>
      <div className="w-full h-full p-4 md:p-6 flex flex-col gap-4 overflow-hidden">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-orange-500/10 p-5">
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-yellow-500/10 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-md">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">GP Redeem</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Rent study materials with Golden Points · Open inside the app or in a new tab · Uploaders keep 90%
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-4 py-2 rounded-xl bg-background/80 backdrop-blur border border-border/60 flex items-center gap-2 shadow-sm">
                <Coins className="w-4 h-4 text-yellow-500" />
                <div className="flex flex-col leading-none">
                  <span className="text-base font-bold tabular-nums">{balance}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider">Your GP</span>
                </div>
              </div>
              <Button onClick={() => { setEditing(null); setUploadOpen(true); }} className="gap-1.5 h-10">
                <Plus className="w-4 h-4" /> Upload Material
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="browse" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="self-start h-9">
            <TabsTrigger value="browse" className="text-xs"><Search className="w-3.5 h-3.5 mr-1.5" />Browse</TabsTrigger>
            <TabsTrigger value="library" className="text-xs"><Library className="w-3.5 h-3.5 mr-1.5" />My Library
              {myLibrary.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[9px]">{myLibrary.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="text-xs"><Heart className="w-3.5 h-3.5 mr-1.5" />Wishlist
              {wishlistMaterials.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[9px]">{wishlistMaterials.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="uploads" className="text-xs"><UploadIcon className="w-3.5 h-3.5 mr-1.5" />My Uploads
              {myUploads.length > 0 && <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-[9px]">{myUploads.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="earnings" className="text-xs"><TrendingUp className="w-3.5 h-3.5 mr-1.5" />Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="flex-1 overflow-hidden mt-3">
            <div className="flex flex-col md:flex-row gap-2 mb-3">
              <Input placeholder="Search title, description, keywords…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="popular">Most rented</SelectItem>
                  <SelectItem value="rating">Top rated</SelectItem>
                  <SelectItem value="cheap">Cheapest</SelectItem>
                  <SelectItem value="featured">Featured first</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-1 flex-wrap">
                {['all', 'pdf', 'drive', 'youtube', 'github', 'url', 'image'].map((t) => (
                  <Button
                    key={t}
                    size="sm"
                    variant={filterType === t ? 'default' : 'outline'}
                    onClick={() => setFilterType(t)}
                    className="capitalize text-xs"
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
            <ScrollArea className="h-[calc(100vh-320px)]">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-8 text-center">Loading…</p>
              ) : filtered.length === 0 ? (
                <div className="text-center p-8">
                  <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No materials yet. Be the first to upload!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-3">
                  {filtered.map((m) => {
                    const owned = m.uploader_id === user?.id;
                    const access = accessibleIds.has(m.id) || owned;
                    return (
                      <MaterialCard
                        key={m.id}
                        material={m}
                        isOwner={owned}
                        hasAccess={access}
                        onOpen={() => setViewerId(m.id)}
                        onOpenExternal={access ? () => handleOpenExternal(m.id) : undefined}
                        onRent={() => setRentTarget(m)}
                      />
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="library" className="flex-1 overflow-hidden mt-3">
            <ScrollArea className="h-[calc(100vh-260px)]">
              {myLibrary.length === 0 ? (
                <p className="text-sm text-muted-foreground p-8 text-center">No active rentals. Browse to find materials.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-3">
                  {myLibrary.map((p) => {
                    const m = libraryMaterialMap.get(p.material_id);
                    if (!m) return null;
                    return (
                      <MaterialCard
                        key={p.id}
                        material={m}
                        hasAccess
                        onOpen={() => setViewerId(m.id)}
                        onOpenExternal={() => handleOpenExternal(m.id)}
                        onRent={() => setRentTarget(m)}
                        onExtend={() => setRentTarget(m)}
                        onReview={() => setReviewTarget(m)}
                        rentalExpiresAt={p.expires_at}
                      />
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="uploads" className="flex-1 overflow-hidden mt-3">
            <ScrollArea className="h-[calc(100vh-260px)]">
              {myUploads.length === 0 ? (
                <p className="text-sm text-muted-foreground p-8 text-center">You haven't uploaded anything yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-3">
                  {myUploads.map((m) => (
                    <MaterialCard
                      key={m.id}
                      material={m}
                      isOwner
                      onOpen={() => setViewerId(m.id)}
                      onOpenExternal={() => handleOpenExternal(m.id)}
                      onEdit={() => { setEditing(m); setUploadOpen(true); }}
                      onTogglePause={() => {
                        const next = m.status === 'paused' ? 'active' : 'paused';
                        updateMaterial.mutate({ id: m.id, status: next as any });
                        toast({
                          title: next === 'paused' ? 'Listing paused' : 'Listing resumed',
                          description: next === 'paused'
                            ? 'Hidden from Browse. Existing renters keep access until expiry.'
                            : 'Visible in Browse again.',
                        });
                      }}
                      onDelete={() => setDeleteTarget(m)}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="earnings" className="flex-1 mt-3">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">Lifetime stats</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-2xl font-bold">{myUploads.reduce((s, m) => s + m.purchase_count, 0)}</div>
                  <div className="text-xs text-muted-foreground">Total rentals</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{myUploads.length}</div>
                  <div className="text-xs text-muted-foreground">Materials live</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{myUploads.reduce((s, m) => s + m.view_count, 0)}</div>
                  <div className="text-xs text-muted-foreground">Total views</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Detailed transaction history is available in your <strong>Points History</strong>.
                Earnings are credited automatically as <code>marketplace</code> entries.
              </p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <UploadMaterialDialog open={uploadOpen} onOpenChange={(v) => { setUploadOpen(v); if (!v) setEditing(null); }} editing={editing} />
      <PurchaseDialog material={rentTarget} onClose={() => setRentTarget(null)} />
      <MaterialViewer materialId={viewerId} onClose={() => setViewerId(null)} />
      <ReviewDialog
        materialId={reviewTarget?.id || null}
        materialTitle={reviewTarget?.title}
        onClose={() => setReviewTarget(null)}
      />
      <DeleteUploadDialog material={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </GroupingLayout>
  );
}

import { useMemo, useState } from 'react';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Coins, Plus, Search, Library, Upload as UploadIcon, TrendingUp, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUserPoints } from '@/hooks/useUserPoints';
import { useMarketplace, type MarketplaceMaterial } from '@/hooks/useMarketplace';
import { MaterialCard } from '@/components/marketplace/MaterialCard';
import { UploadMaterialDialog } from '@/components/marketplace/UploadMaterialDialog';
import { PurchaseDialog } from '@/components/marketplace/PurchaseDialog';
import { MaterialViewer } from '@/components/marketplace/MaterialViewer';
import { Badge } from '@/components/ui/badge';

export default function GroupingMarketplace() {
  const { user } = useAuth();
  const { getUserPoints } = useUserPoints();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editing, setEditing] = useState<MarketplaceMaterial | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [rentTarget, setRentTarget] = useState<MarketplaceMaterial | null>(null);

  const { materials, isLoading, myUploads, myLibrary, removeMaterial, updateMaterial } = useMarketplace(search);
  const balance = user ? getUserPoints(user.id) : 0;

  const filtered = useMemo(() => {
    if (filterType === 'all') return materials;
    return materials.filter((m) => m.material_type === filterType);
  }, [materials, filterType]);

  const libraryMaterialMap = useMemo(() => {
    const map = new Map<string, MarketplaceMaterial>();
    materials.forEach((m) => map.set(m.id, m));
    myUploads.forEach((m) => map.set(m.id, m));
    return map;
  }, [materials, myUploads]);

  const accessibleIds = useMemo(() => new Set(myLibrary.map((p) => p.material_id)), [myLibrary]);

  return (
    <GroupingLayout>
      <div className="w-full h-full p-4 md:p-6 flex flex-col gap-4 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Coins className="w-6 h-6 text-yellow-500" />
              GP Redeem
            </h1>
            <p className="text-xs text-muted-foreground">
              Rent study materials with Golden Points · Uploaders earn 90% per sale · 10% to team treasury
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Card className="px-3 py-2 flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-bold">{balance}</span>
              <span className="text-[10px] text-muted-foreground">GP</span>
            </Card>
            <Button onClick={() => { setEditing(null); setUploadOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Upload
            </Button>
          </div>
        </div>

        <Tabs defaultValue="browse" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="self-start">
            <TabsTrigger value="browse"><Search className="w-3.5 h-3.5 mr-1" />Browse</TabsTrigger>
            <TabsTrigger value="library"><Library className="w-3.5 h-3.5 mr-1" />My Library ({myLibrary.length})</TabsTrigger>
            <TabsTrigger value="uploads"><UploadIcon className="w-3.5 h-3.5 mr-1" />My Uploads ({myUploads.length})</TabsTrigger>
            <TabsTrigger value="earnings"><TrendingUp className="w-3.5 h-3.5 mr-1" />Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="flex-1 overflow-hidden mt-3">
            <div className="flex flex-col md:flex-row gap-2 mb-3">
              <Input placeholder="Search title, description, keywords…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <ScrollArea className="h-[calc(100vh-280px)]">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-8 text-center">Loading…</p>
              ) : filtered.length === 0 ? (
                <div className="text-center p-8">
                  <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No materials yet. Be the first to upload!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-3">
                  {filtered.map((m) => (
                    <MaterialCard
                      key={m.id}
                      material={m}
                      isOwner={m.uploader_id === user?.id}
                      hasAccess={accessibleIds.has(m.id) || m.uploader_id === user?.id}
                      onOpen={() => setViewerId(m.id)}
                      onRent={() => setRentTarget(m)}
                    />
                  ))}
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
                      <div key={p.id} className="relative space-y-2">
                        <MaterialCard
                          material={m}
                          hasAccess
                          onOpen={() => setViewerId(m.id)}
                          onRent={() => setRentTarget(m)}
                          rentalExpiresAt={p.expires_at}
                        />
                      </div>
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
                      onEdit={() => { setEditing(m); setUploadOpen(true); }}
                      onDelete={() => {
                        if (confirm('Remove this material? Existing renters keep access until expiry.')) {
                          removeMaterial.mutate(m.id);
                        }
                      }}
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
    </GroupingLayout>
  );
}

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Coins } from 'lucide-react';
import type { MarketplaceMaterial } from '@/hooks/useMarketplace';
import { useUserPoints } from '@/hooks/useUserPoints';
import { useAuth } from '@/hooks/useAuth';
import { useMarketplace } from '@/hooks/useMarketplace';

interface Props {
  material: MarketplaceMaterial | null;
  onClose: () => void;
}

export function PurchaseDialog({ material, onClose }: Props) {
  const [days, setDays] = useState(1);
  const { user } = useAuth();
  const { getUserPoints } = useUserPoints();
  const { purchase } = useMarketplace();

  const balance = user ? getUserPoints(user.id) : 0;

  const { gross, total, pct } = useMemo(() => {
    if (!material) return { gross: 0, total: 0, pct: 0 };
    const g = material.price_per_day * days;
    let p = 0;
    if (days >= 30) p = material.discount_pct_30d;
    else if (days >= 7) p = material.discount_pct_7d;
    return { gross: g, total: Math.round(g * (100 - p) / 100), pct: p };
  }, [material, days]);

  if (!material) return null;
  const insufficient = balance < total;

  return (
    <Dialog open={!!material} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-500" /> Rent "{material.title}"
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Days</span>
              <span className="font-semibold">{days} day{days > 1 ? 's' : ''}</span>
            </div>
            <Slider
              value={[days]}
              min={material.min_days}
              max={material.max_days}
              step={1}
              onValueChange={(v) => setDays(v[0])}
            />
          </div>
          <div className="rounded-lg border p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Rate</span><span>{material.price_per_day} GP/day</span></div>
            <div className="flex justify-between"><span>Subtotal</span><span>{gross} GP</span></div>
            {pct > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span><span>−{pct}%</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-1 mt-1">
              <span>Total</span><span>{total} GP</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Your balance</span><span>{balance} GP</span>
            </div>
          </div>
          {insufficient && (
            <div className="text-xs text-destructive">
              Not enough Golden Points. Earn more via Skill Challenges.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={insufficient || purchase.isPending}
            onClick={async () => {
              await purchase.mutateAsync({ materialId: material.id, days });
              onClose();
            }}
          >
            Confirm rental
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

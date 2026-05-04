import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Trash2, Archive } from 'lucide-react';
import type { MarketplaceMaterial } from '@/hooks/useMarketplace';
import { useMarketplace } from '@/hooks/useMarketplace';

interface Props {
  material: MarketplaceMaterial | null;
  onClose: () => void;
}

export function DeleteUploadDialog({ material, onClose }: Props) {
  const { removeMaterial, hardDeleteMaterial } = useMarketplace();
  if (!material) return null;
  const hasHistory = material.purchase_count > 0;

  return (
    <Dialog open={!!material} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Delete "{material.title}"?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">Choose how you want to remove this material:</p>

          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 font-medium"><Archive className="w-4 h-4" /> Remove from listing</div>
            <p className="text-xs text-muted-foreground">
              Hides it from Browse. Existing renters keep access until their rental expires. Recommended.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={async () => { await removeMaterial.mutateAsync(material.id); onClose(); }}
              disabled={removeMaterial.isPending}
            >
              Remove from listing
            </Button>
          </div>

          <div className="rounded-lg border border-destructive/30 p-3 space-y-2 bg-destructive/5">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <Trash2 className="w-4 h-4" /> Hard delete
            </div>
            <p className="text-xs text-muted-foreground">
              Permanently deletes the material. {hasHistory
                ? 'Disabled — this material has rental history.'
                : 'Allowed because there are no rentals.'}
            </p>
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              disabled={hasHistory || hardDeleteMaterial.isPending}
              onClick={async () => { await hardDeleteMaterial.mutateAsync(material.id); onClose(); }}
            >
              Hard delete
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

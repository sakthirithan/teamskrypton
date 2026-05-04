import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { useMarketplace } from '@/hooks/useMarketplace';

interface Props {
  materialId: string | null;
  materialTitle?: string;
  onClose: () => void;
}

export function ReviewDialog({ materialId, materialTitle, onClose }: Props) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const { submitReview } = useMarketplace();

  const submit = async () => {
    if (!materialId) return;
    await submitReview.mutateAsync({ materialId, rating, comment: comment.trim() || undefined });
    setComment('');
    setRating(5);
    onClose();
  };

  return (
    <Dialog open={!!materialId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rate "{materialTitle || 'this material'}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (hover || rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(n)}
                  className="p-1 hover:scale-110 transition-transform"
                  aria-label={`${n} stars`}
                >
                  <Star className={`w-8 h-8 ${active ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                </button>
              );
            })}
          </div>
          <Textarea
            placeholder="Optional: what made it useful (or not)?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={400}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={submitReview.isPending}>Submit review</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

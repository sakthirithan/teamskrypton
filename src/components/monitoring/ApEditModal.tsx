import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Coins, Check, X, Loader2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ApEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberName: string;
  currentAp: number;
  targetAp: number;
  userId: string;
  onSaveAp: (params: { userId: string; points: number; reason?: string }) => Promise<void>;
}

export function ApEditModal({
  isOpen,
  onClose,
  memberName,
  currentAp,
  targetAp,
  userId,
  onSaveAp,
}: ApEditModalProps) {
  const [apInput, setApInput] = useState(currentAp.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setApInput(currentAp.toString());
    setErrorMsg(null);
  }, [currentAp, isOpen]);

  const handleQuickAdd = (pts: number) => {
    const parsed = parseInt(apInput, 10) || 0;
    setApInput((parsed + pts).toString());
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericVal = parseInt(apInput, 10);
    if (isNaN(numericVal)) {
      setErrorMsg('Please enter a valid numeric AP value.');
      return;
    }
    if (numericVal < 0) {
      setErrorMsg('AP value cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveAp({ userId, points: numericVal, reason: 'Lead manual edit' });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update AP value.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] backdrop-blur-xl bg-card/95 border border-amber-500/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-extrabold text-foreground">
            <Coins className="w-5 h-5 text-amber-500" />
            Adjust Activity Points (AP)
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Manually update Activity Points for <strong className="text-foreground">{memberName}</strong>. Updates the single source-of-truth across all dashboards.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          {/* Current & Target Stats */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Current AP</span>
              <p className="text-lg font-extrabold text-amber-400">{currentAp.toLocaleString()} AP</p>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Requirement Target</span>
              <p className="text-lg font-extrabold text-foreground">{targetAp.toLocaleString()} AP</p>
            </div>
          </div>

          {/* New AP Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
              <span>New AP Value</span>
              {parseInt(apInput, 10) >= targetAp && (
                <Badge variant="outline" className="text-[10px] font-bold border-emerald-400/40 text-emerald-400 bg-emerald-500/10">
                  Target Met
                </Badge>
              )}
            </Label>
            <Input
              type="number"
              min="0"
              value={apInput}
              onChange={(e) => setApInput(e.target.value)}
              className="text-base font-extrabold font-mono bg-background/80"
              placeholder="Enter new AP points..."
              autoFocus
              required
            />
          </div>

          {/* Quick Increment Buttons */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Quick Add Points:</span>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs font-bold text-amber-400 border-amber-500/30" onClick={() => handleQuickAdd(50)}>
                +50 AP
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs font-bold text-amber-400 border-amber-500/30" onClick={() => handleQuickAdd(100)}>
                +100 AP
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs font-bold text-amber-400 border-amber-500/30" onClick={() => handleQuickAdd(500)}>
                +500 AP
              </Button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <p className="text-xs font-bold text-destructive bg-destructive/10 p-2 rounded-lg border border-destructive/20">
              {errorMsg}
            </p>
          )}

          <DialogFooter className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {isSubmitting ? 'Saving...' : 'Save AP Points'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

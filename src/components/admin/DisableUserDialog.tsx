import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, ShieldAlert, ShieldCheck, EyeOff, Eye } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string;
  targetUserName: string;
  currentlyDisabled: boolean;
  onDone: () => void;
}

export function DisableUserDialog({ open, onOpenChange, targetUserId, targetUserName, currentlyDisabled, onDone }: Props) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'hidden' | 'read_only'>('hidden');
  const [reason, setReason] = useState('');
  const [until, setUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setMode('hidden');
    setReason('');
    setUntil('');
  };

  const handleSubmit = async (disable: boolean) => {
    if (disable && !reason.trim()) {
      toast({ variant: 'destructive', title: 'Reason required', description: 'Please provide a reason the user will see.' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('toggle_profile_status', {
        _target_user_id: targetUserId,
        _disable: disable,
        _mode: disable ? mode : null,
        _reason: reason.trim() || null,
        _disabled_until: disable && until ? new Date(until).toISOString() : null,
      });
      if (error) throw error;
      toast({
        title: disable ? 'Profile Disabled' : 'Profile Enabled',
        description: disable
          ? `${targetUserName} is now ${mode === 'hidden' ? 'hidden' : 'in read-only mode'}.`
          : `${targetUserName} has been reactivated.`,
      });
      reset();
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentlyDisabled ? <ShieldCheck className="w-5 h-5 text-green-600" /> : <ShieldAlert className="w-5 h-5 text-destructive" />}
            {currentlyDisabled ? 'Enable Profile' : 'Disable Profile'}
          </DialogTitle>
          <DialogDescription>
            {currentlyDisabled
              ? `Reactivate ${targetUserName}. Their profile will be visible everywhere again.`
              : `${targetUserName} will be hidden from the app. Their data stays intact.`}
          </DialogDescription>
        </DialogHeader>

        {currentlyDisabled ? (
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg border bg-green-500/10 border-green-500/30 text-sm">
              Enabling will restore full access immediately.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
              <Button onClick={() => handleSubmit(false)} disabled={saving} className="flex-1">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enable Profile
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">Suspension mode</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="hidden" id="m-hidden" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium text-sm"><EyeOff className="w-4 h-4" /> Hidden</div>
                    <p className="text-xs text-muted-foreground mt-0.5">User cannot sign in. Hidden from all lists, cards, and leaderboards.</p>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                  <RadioGroupItem value="read_only" id="m-ro" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium text-sm"><Eye className="w-4 h-4" /> Read-Only</div>
                    <p className="text-xs text-muted-foreground mt-0.5">User can sign in and view their own data, but cannot edit, create, or vote. Still hidden from others.</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="reason">Reason <span className="text-destructive">*</span></Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="This message is shown to the user on the suspension screen."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="until">Auto-restore on <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="until"
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
              <p className="text-xs text-muted-foreground mt-1">Leave blank to keep suspended until manually enabled.</p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
              <Button variant="destructive" onClick={() => handleSubmit(true)} disabled={saving} className="flex-1">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Disable
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

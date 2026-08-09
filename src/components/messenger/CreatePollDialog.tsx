import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, BarChart2, Loader2 } from 'lucide-react';
import { usePolls } from '@/hooks/usePolls';
import { useToast } from '@/hooks/use-toast';

interface CreatePollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPollCreated?: (pollId: string, title: string) => void;
}

export function CreatePollDialog({ open, onOpenChange, onPollCreated }: CreatePollDialogProps) {
  const { createPoll } = usePolls('grouping');
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);

  const handleAddOption = () => {
    if (options.length >= 6) {
      toast({ title: 'Option Limit', description: 'Maximum 6 options allowed per poll.' });
      return;
    }
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      toast({ title: 'Minimum Options', description: 'At least 2 options are required.' });
      return;
    }
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, val: string) => {
    setOptions((prev) => {
      const copy = [...prev];
      copy[index] = val;
      return copy;
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({ variant: 'destructive', title: 'Question required' });
      return;
    }

    const validOptions = options.map((o) => o.trim()).filter(Boolean);
    if (validOptions.length < 2) {
      toast({ variant: 'destructive', title: 'Invalid Options', description: 'Provide at least 2 non-empty options.' });
      return;
    }

    try {
      // 48-hour expiration deadline
      const deadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const res = await createPoll.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        options: validOptions,
        deadline,
        allow_multiple: false,
        anonymous: false,
      });

      if (onPollCreated && res?.id) {
        onPollCreated(res.id, title.trim());
      }

      setTitle('');
      setDescription('');
      setOptions(['', '']);
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to create poll', description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <BarChart2 className="w-5 h-5 text-primary" />
            Create 48-Hour Team Poll
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Poll Question *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Which sprint target should we prioritize first?"
              className="h-9 text-xs rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground">Description (Optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add optional context or instructions..."
              className="min-h-[60px] text-xs rounded-xl resize-none"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">Options (Min 2)</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddOption}
                className="h-7 text-xs font-bold text-primary gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Option
              </Button>
            </div>

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="h-9 text-xs rounded-xl flex-1"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(idx)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground italic bg-muted/30 p-2.5 rounded-xl">
            ⏰ Polls automatically expire and lock after 48 hours.
          </p>

          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs rounded-xl">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={createPoll.isPending || !title.trim()}
              className="text-xs font-bold rounded-xl px-4"
            >
              {createPoll.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Publish Poll
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ArrowUp, ArrowDown, Sliders, Check } from 'lucide-react';

export interface NavRouteOption {
  id: string;
  label: string;
  path: string;
  iconName: string;
}

export const ALL_NAV_OPTIONS: NavRouteOption[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/grouping/home', iconName: 'LayoutDashboard' },
  { id: 'team', label: 'Team', path: '/team', iconName: 'Users' },
  { id: 'leaderboard', label: 'Leaderboard', path: '/grouping/leaderboard', iconName: 'TrendingUp' },
  { id: 'notifications', label: 'Notifications', path: '/grouping/notifications', iconName: 'Bell' },
  { id: 'myspace', label: 'My Space', path: '/grouping/me', iconName: 'User' },
  { id: 'psportal', label: 'PS Portal', path: '/grouping/ps', iconName: 'FolderKanban' },
  { id: 'todos', label: 'To-Do List', path: '/grouping/todos', iconName: 'CheckSquare' },
  { id: 'skills', label: 'Team Skills', path: '/grouping/skills', iconName: 'Zap' },
  { id: 'notes', label: 'Notes', path: '/grouping/notes', iconName: 'Bookmark' },
  { id: 'reflections', label: 'Reflections', path: '/grouping/reflections', iconName: 'MessageSquare' },
  { id: 'habits', label: 'Habits', path: '/grouping/habits', iconName: 'CheckSquare' },
];

export const DEFAULT_NAV_IDS = ['dashboard', 'team', 'leaderboard', 'notifications'];

export function getUserNavPreferences(userId?: string): string[] {
  if (!userId) return DEFAULT_NAV_IDS;
  try {
    const saved = localStorage.getItem(`krypton_mobile_nav_config_${userId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length >= 2 && parsed.length <= 5) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to parse user nav preferences:', e);
  }
  return DEFAULT_NAV_IDS;
}

interface CustomizeNavDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: (selectedIds: string[]) => void;
}

export function CustomizeNavDialog({ open, onOpenChange, onSave }: CustomizeNavDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open && user) {
      setSelectedIds(getUserNavPreferences(user.id));
    }
  }, [open, user]);

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 2) {
        toast({
          title: 'Minimum Reached',
          description: 'Choose at least 2 quick actions for your mobile bar.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 5) {
        toast({
          title: 'Maximum Reached',
          description: 'You can select up to 5 quick actions.',
          variant: 'destructive',
        });
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selectedIds.length) return;
    const updated = [...selectedIds];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSelectedIds(updated);
  };

  const handleSave = () => {
    if (selectedIds.length < 2) {
      toast({
        title: 'Minimum Reached',
        description: 'Choose at least 2 quick actions.',
        variant: 'destructive',
      });
      return;
    }
    if (user) {
      localStorage.setItem(`krypton_mobile_nav_config_${user.id}`, JSON.stringify(selectedIds));
    }
    toast({
      title: 'Navigation Customised',
      description: 'Your mobile bottom bar layout has been updated.',
    });
    if (onSave) onSave(selectedIds);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md rounded-2xl p-4 sm:p-6 bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Sliders className="w-4 h-4 text-primary" />
            Customize Quick Actions
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select 2 to 5 quick actions for your floating bottom navigation bar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selected & Ordering */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-primary">
              Active Quick Actions ({selectedIds.length}/5)
            </Label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto p-1 bg-muted/30 rounded-xl border border-border/50">
              {selectedIds.map((id, index) => {
                const opt = ALL_NAV_OPTIONS.find((o) => o.id === id);
                if (!opt) return null;
                return (
                  <div
                    key={id}
                    className="flex items-center justify-between p-2 rounded-lg bg-card border border-border/70 text-xs shadow-xs"
                  >
                    <span className="font-semibold text-foreground">
                      {index + 1}. {opt.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === 0}
                        onClick={() => moveItem(index, 'up')}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={index === selectedIds.length - 1}
                        onClick={() => moveItem(index, 'down')}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Available Destinations Checkboxes */}
          <div className="space-y-2">
            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              All Available Destinations
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
              {ALL_NAV_OPTIONS.map((opt) => {
                const isChecked = selectedIds.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleSelect(opt.id)}
                    className={`flex items-center space-x-2.5 p-2 rounded-xl border cursor-pointer transition-colors text-xs ${
                      isChecked
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-border/60 bg-card hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <Checkbox checked={isChecked} onCheckedChange={() => toggleSelect(opt.id)} />
                    <span className="flex-1 truncate">{opt.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs h-9">
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} className="text-xs h-9 font-semibold">
            <Check className="w-3.5 h-3.5 mr-1" />
            Save Quick Actions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

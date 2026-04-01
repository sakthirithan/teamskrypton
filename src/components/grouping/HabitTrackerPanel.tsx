import { useState, useMemo } from 'react';
import { useHabits, Habit } from '@/hooks/useHabits';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Plus, CheckCircle2, Circle, Flame, Target, MoreVertical,
  Pencil, Trash2, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from 'date-fns';

export function HabitTrackerPanel() {
  const { user, isLeadership } = useAuth();
  const {
    habits, revokeRequests, isLoading,
    createHabit, updateHabit, deleteHabit,
    toggleCompletion, requestRevoke, reviewRevoke,
    getCompletionDates, getStreak,
  } = useHabits();

  const [createOpen, setCreateOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [revokeHabit, setRevokeHabit] = useState<Habit | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isGlobal, setIsGlobal] = useState(false);
  const [revokeReason, setRevokeReason] = useState('');
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [calMonth, setCalMonth] = useState(new Date());

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Stats
  const activeHabits = habits.length;
  const doneToday = habits.filter(h => getCompletionDates(h.id).has(todayStr)).length;
  const bestStreak = habits.reduce((max, h) => Math.max(max, getStreak(h.id)), 0);

  // Pending revoke requests (for leads)
  const pendingRevokes = revokeRequests.filter(r => r.status === 'pending');

  const handleCreate = async () => {
    if (!title.trim()) return;
    await createHabit(title, description, isGlobal);
    setTitle(''); setDescription(''); setIsGlobal(false); setCreateOpen(false);
  };

  const handleEdit = async () => {
    if (!editHabit || !title.trim()) return;
    await updateHabit(editHabit.id, title, description);
    setTitle(''); setDescription(''); setEditHabit(null);
  };

  const handleRevoke = async () => {
    if (!revokeHabit || !revokeReason.trim()) return;
    await requestRevoke(revokeHabit.id, revokeReason);
    setRevokeReason(''); setRevokeHabit(null);
  };

  const canManageHabit = (habit: Habit) => {
    if (isLeadership) return true;
    return !habit.is_global && habit.user_id === user?.id;
  };

  // Calendar data
  const calendarDays = useMemo(() => {
    const start = startOfMonth(calMonth);
    const end = endOfMonth(calMonth);
    return eachDayOfInterval({ start, end });
  }, [calMonth]);

  const startDayOfWeek = getDay(startOfMonth(calMonth));
  const completionDatesForSelected = selectedHabit ? getCompletionDates(selectedHabit.id) : new Set<string>();

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading habits...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Habits</h2>
          <p className="text-sm text-muted-foreground">Build consistency with daily habit tracking</p>
        </div>
        <Button onClick={() => { setTitle(''); setDescription(''); setIsGlobal(false); setCreateOpen(true); }} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New Habit
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Habits</p>
              <p className="text-2xl font-bold mt-1">{activeHabits}</p>
            </div>
            <Target className="w-8 h-8 text-primary opacity-60" />
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Done Today</p>
              <p className="text-2xl font-bold mt-1">{doneToday}/{activeHabits}</p>
              <p className="text-[10px] text-muted-foreground">habits completed</p>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-500 opacity-60" />
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Best Streak</p>
              <p className="text-2xl font-bold mt-1">{bestStreak}</p>
              <p className="text-[10px] text-muted-foreground">days in a row</p>
            </div>
            <Flame className="w-8 h-8 text-orange-500 opacity-60" />
          </CardContent>
        </Card>
      </div>

      {/* Pending Revoke Requests (Leadership only) */}
      {isLeadership && pendingRevokes.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Pending Revoke Requests ({pendingRevokes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingRevokes.map(req => {
              const habit = habits.find(h => h.id === req.habit_id);
              return (
                <div key={req.id} className="flex items-center justify-between p-2 rounded-lg bg-background border text-sm">
                  <div>
                    <span className="font-medium">{habit?.title || 'Unknown'}</span>
                    <p className="text-xs text-muted-foreground">{req.reason}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => reviewRevoke(req.id, true)}>
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => reviewRevoke(req.id, false)}>
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Habit List */}
      {habits.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Target className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No habits yet. Create your first habit to start tracking!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {habits.map(habit => {
            const completedToday = getCompletionDates(habit.id).has(todayStr);
            const streak = getStreak(habit.id);
            const totalCompletions = getCompletionDates(habit.id).size;
            const isSelected = selectedHabit?.id === habit.id;

            return (
              <Card
                key={habit.id}
                className={`cursor-pointer transition-all hover:shadow-sm ${isSelected ? 'ring-2 ring-primary/30' : ''}`}
                onClick={() => setSelectedHabit(isSelected ? null : habit)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      className="mt-0.5 flex-shrink-0"
                      onClick={(e) => { e.stopPropagation(); toggleCompletion(habit.id, todayStr); }}
                    >
                      {completedToday ? (
                        <CheckCircle2 className="w-5 h-5 text-primary" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground/40" />
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium text-sm ${completedToday ? 'line-through text-muted-foreground' : ''}`}>
                          {habit.title}
                        </p>
                        {habit.is_global && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">Global</Badge>
                        )}
                      </div>
                      {habit.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{habit.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
                        <span>{format(new Date(habit.created_at), 'MMM d, yyyy')}</span>
                        <span>{totalCompletions} habit completions</span>
                        {streak > 0 && (
                          <span className="flex items-center gap-0.5 text-orange-500">
                            <Flame className="w-3 h-3" /> {streak}d streak
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      {/* Revoke request for non-leadership on global habits with 0 completions */}
                      {!isLeadership && habit.is_global && totalCompletions === 0 && (
                        <Button
                          size="sm" variant="ghost" className="h-7 text-xs text-amber-600"
                          onClick={() => setRevokeHabit(habit)}
                        >
                          Request Revoke
                        </Button>
                      )}
                      {canManageHabit(habit) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setTitle(habit.title); setDescription(habit.description || '');
                              setEditHabit(habit);
                            }}>
                              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => deleteHabit(habit.id)}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Calendar View for selected habit */}
      {selectedHabit && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h3 className="text-sm font-semibold">{format(calMonth, 'MMMM yyyy')}</h3>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
              ))}
              {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
              {calendarDays.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const completed = completionDatesForSelected.has(dateStr);
                const today = isToday(day);
                return (
                  <button
                    key={dateStr}
                    className={`aspect-square rounded-md text-xs font-medium flex items-center justify-center transition-colors
                      ${completed ? 'bg-primary text-primary-foreground' : ''}
                      ${today && !completed ? 'border-2 border-primary' : ''}
                      ${!completed && !today ? 'hover:bg-muted' : ''}
                    `}
                    onClick={() => toggleCompletion(selectedHabit.id, dateStr)}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Completed</span>
              <span className="flex items-center gap-1"><Circle className="w-2.5 h-2.5" /> Missed</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Habit</DialogTitle>
            <DialogDescription>Create a new habit to track daily.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Solve 5 coding problems" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." rows={2} />
            </div>
            {isLeadership && (
              <div className="flex items-center gap-2">
                <Switch checked={isGlobal} onCheckedChange={setIsGlobal} />
                <Label>Global habit (applies to all members)</Label>
              </div>
            )}
            <Button onClick={handleCreate} className="w-full" disabled={!title.trim()}>Create Habit</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editHabit} onOpenChange={open => { if (!open) setEditHabit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Habit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <Button onClick={handleEdit} className="w-full" disabled={!title.trim()}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={!!revokeHabit} onOpenChange={open => { if (!open) setRevokeHabit(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Habit Revoke</DialogTitle>
            <DialogDescription>
              Since you have no completions for "{revokeHabit?.title}", you can request removal. A lead will review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Textarea value={revokeReason} onChange={e => setRevokeReason(e.target.value)} placeholder="Why do you want to revoke this habit?" rows={3} />
            </div>
            <Button onClick={handleRevoke} className="w-full" disabled={!revokeReason.trim()}>Submit Request</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

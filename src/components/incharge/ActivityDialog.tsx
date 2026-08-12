import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ACTIVITY_CATEGORIES, ScheduleActivity } from '@/hooks/useIncharge';
import { Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  activity?: ScheduleActivity | null;
  defaultDate: string;
  defaultHour?: number;
  members: Array<{ user_id: string; full_name: string; department: string }>;
  initialMemberIds?: string[];
  canDelete?: boolean;
  canEdit?: boolean;
  onSave: (input: {
    id?: string;
    title: string;
    description?: string;
    activity_date: string;
    start_time: string;
    end_time: string;
    category: string;
    location?: string;
    memberIds: string[];
  }) => void;
  onDelete?: (id: string) => void;
  saving?: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function ActivityDialog({
  open,
  onOpenChange,
  activity,
  defaultDate,
  defaultHour = 9,
  members,
  initialMemberIds = [],
  canDelete = true,
  canEdit = true,
  onSave,
  onDelete,
  saving,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState(`${pad(defaultHour)}:00`);
  const [end, setEnd] = useState(`${pad(Math.min(defaultHour + 1, 23))}:00`);
  const [category, setCategory] = useState('general');
  const [location, setLocation] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const allSelected = members.length > 0 && members.every((m) => memberIds.includes(m.user_id));

  useEffect(() => {
    if (!open) return;
    if (activity) {
      setTitle(activity.title);
      setDescription(activity.description || '');
      setDate(activity.activity_date);
      setStart(activity.start_time.slice(0, 5));
      setEnd(activity.end_time.slice(0, 5));
      setCategory(activity.category);
      setLocation(activity.location || '');
      setMemberIds(initialMemberIds);
    } else {
      setTitle('');
      setDescription('');
      setDate(defaultDate);
      setStart(`${pad(defaultHour)}:00`);
      setEnd(`${pad(Math.min(defaultHour + 1, 23))}:00`);
      setCategory('general');
      setLocation('');
      setMemberIds([]);
    }
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity?.id, defaultDate, defaultHour]);

  const filtered = useMemo(
    () =>
      members.filter((m) =>
        `${m.full_name} ${m.department}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [members, search],
  );

  const isFinalized = activity?.status === 'final';
  const readOnly = isFinalized && !canEdit;
  const valid = canEdit && title.trim().length > 1 && date && start && end && end > start;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[92vh] overflow-hidden p-4 sm:p-6">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>{activity ? 'Activity Details' : 'Create Activity'}</DialogTitle>
          {isFinalized && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {readOnly ? 'Finalized (Read-Only)' : 'Finalized'}
            </span>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-3">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                disabled={readOnly}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Activity title"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                disabled={readOnly}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What happens in this slot?"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input
                  disabled={readOnly}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select disabled={readOnly} value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Start time</Label>
                <Input disabled={readOnly} type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>End time</Label>
                <Input disabled={readOnly} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Location (optional)</Label>
              <Input disabled={readOnly} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lab, hall, online…" />
            </div>

            <div className="space-y-1.5">
              <Label>Assigned members ({memberIds.length})</Label>
              {!readOnly && (
                <>
                  <label className="mb-2 flex cursor-pointer items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-2 text-sm font-semibold">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(c) =>
                        // Assign to every eligible member — de-duplicated via a Set
                        setMemberIds(c ? Array.from(new Set(members.map((m) => m.user_id))) : [])
                      }
                    />
                    <span className="flex-1">All eligible members</span>
                    <span className="text-xs font-normal text-muted-foreground">{members.length}</span>
                  </label>
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search members…"
                    className="mb-2"
                  />
                </>
              )}
              <ScrollArea className="h-44 rounded-md border border-border">
                <div className="p-2 space-y-1">
                  {filtered.map((m) => (
                    <label
                      key={m.user_id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        disabled={readOnly}
                        checked={memberIds.includes(m.user_id)}
                        onCheckedChange={(c) =>
                          setMemberIds((prev) =>
                            c
                              ? Array.from(new Set([...prev, m.user_id]))
                              : prev.filter((id) => id !== m.user_id),
                          )
                        }
                      />
                      <span className="flex-1 truncate">{m.full_name}</span>
                      <span className="text-xs text-muted-foreground truncate">{m.department}</span>
                    </label>
                  ))}
                  {!filtered.length && (
                    <p className="p-2 text-center text-xs text-muted-foreground">No members found</p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:justify-between">
          {activity && canDelete && !readOnly ? (
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                onDelete?.(activity.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          {!readOnly ? (
            <Button
              disabled={!valid || saving}
              onClick={() =>
                onSave({
                  id: activity?.id,
                  title: title.trim(),
                  description,
                  activity_date: date,
                  start_time: start,
                  end_time: end,
                  category,
                  location,
                  memberIds: Array.from(new Set(memberIds)),
                })
              }
            >
              {activity ? 'Save changes' : 'Create activity'}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

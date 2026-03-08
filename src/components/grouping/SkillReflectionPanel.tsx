import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, MessageSquare, Trash2, Edit2, Lightbulb, AlertTriangle, ArrowRight } from 'lucide-react';
import { useSkillReflections, SkillReflection } from '@/hooks/useSkillReflections';
import { format, startOfWeek } from 'date-fns';

interface SkillReflectionPanelProps {
  trackId: string;
  isReadOnly?: boolean;
}

export function SkillReflectionPanel({ trackId, isReadOnly = false }: SkillReflectionPanelProps) {
  const { reflections, addReflection, updateReflection, deleteReflection } = useSkillReflections(trackId);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ content: '', challenges: '', next_steps: '' });

  const currentWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const hasCurrentWeekReflection = reflections.some(r => r.week_start === currentWeek);

  const handleSave = async () => {
    if (!form.content.trim()) return;
    if (editingId) {
      await updateReflection.mutateAsync({ id: editingId, ...form });
      setEditingId(null);
    } else {
      await addReflection.mutateAsync({ week_start: currentWeek, ...form });
    }
    setForm({ content: '', challenges: '', next_steps: '' });
    setIsOpen(false);
  };

  const openEdit = (r: SkillReflection) => {
    setEditingId(r.id);
    setForm({ content: r.content, challenges: r.challenges || '', next_steps: r.next_steps || '' });
    setIsOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-primary" />
          Weekly Reflections
        </h4>
        {!isReadOnly && !hasCurrentWeekReflection && (
          <Dialog open={isOpen} onOpenChange={(o) => { setIsOpen(o); if (!o) { setEditingId(null); setForm({ content: '', challenges: '', next_steps: '' }); } }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="w-3 h-3 mr-1" /> Add Reflection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit' : 'New'} Weekly Reflection</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><Lightbulb className="w-3 h-3" /> What did you learn? *</Label>
                  <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Key learnings this week..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Challenges faced</Label>
                  <Textarea value={form.challenges} onChange={e => setForm({ ...form, challenges: e.target.value })} placeholder="Any blockers or difficulties..." rows={2} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1"><ArrowRight className="w-3 h-3" /> Next steps</Label>
                  <Textarea value={form.next_steps} onChange={e => setForm({ ...form, next_steps: e.target.value })} placeholder="Plans for next week..." rows={2} />
                </div>
                <Button onClick={handleSave} className="w-full" disabled={!form.content.trim() || addReflection.isPending}>
                  {addReflection.isPending || updateReflection.isPending ? 'Saving...' : 'Save Reflection'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {reflections.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No reflections yet.</p>
      ) : (
        <div className="space-y-2">
          {reflections.map(r => (
            <Card key={r.id} className="border-muted">
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px]">Week of {format(new Date(r.week_start), 'MMM dd')}</Badge>
                  {!isReadOnly && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(r)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteReflection.mutate(r.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-sm">{r.content}</p>
                {r.challenges && (
                  <p className="text-xs text-muted-foreground"><span className="font-medium text-amber-600">Challenges:</span> {r.challenges}</p>
                )}
                {r.next_steps && (
                  <p className="text-xs text-muted-foreground"><span className="font-medium text-blue-600">Next:</span> {r.next_steps}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

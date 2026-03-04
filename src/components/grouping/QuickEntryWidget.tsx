import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Zap } from 'lucide-react';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface QuickEntryWidgetProps {
  session: GroupingSession;
  userId: string;
}

export function QuickEntryWidget({ session, userId }: QuickEntryWidgetProps) {
  const { createEntry } = usePSDailyEntries(session.id, userId);
  const { toast } = useToast();
  const [skillName, setSkillName] = useState('');
  const [points, setPoints] = useState('');

  const handleQuickAdd = async () => {
    if (!skillName.trim() || !points) return;

    try {
      await createEntry.mutateAsync({
        session_id: session.id,
        user_id: userId,
        entry_date: format(new Date(), 'yyyy-MM-dd'),
        entry_time: format(new Date(), 'HH:mm'),
        skill_name: skillName.trim(),
        reward_points: parseInt(points) || 0,
        attempt_count: 1,
      });

      setSkillName('');
      setPoints('');
      toast({ title: 'Entry added', description: 'PS entry created as pending.' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed', description: 'Could not add entry.' });
    }
  };

  if (session.status === 'closed') return null;

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1 rounded-md bg-primary/10">
            <Zap className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-sm font-medium">Quick Add Entry</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Skill name..."
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            className="flex-1 h-9 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
          />
          <Input
            type="number"
            placeholder="Pts"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            className="w-20 h-9 text-sm"
            onKeyDown={(e) => e.key === 'Enter' && handleQuickAdd()}
          />
          <Button 
            size="sm" 
            className="h-9 px-3"
            onClick={handleQuickAdd}
            disabled={createEntry.isPending || !skillName.trim() || !points}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Auto-fills today's date & time. Entry starts as Pending.
        </p>
      </CardContent>
    </Card>
  );
}
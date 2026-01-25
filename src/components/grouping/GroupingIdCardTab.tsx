import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { 
  calculateTargetStatus, 
  calculateSessionDays, 
  calculateDaysRemaining,
  TARGET_STATUS_LABELS 
} from '@/lib/groupingConstants';

interface GroupingIdCardTabProps {
  userId: string;
}

export function GroupingIdCardTab({ userId }: GroupingIdCardTabProps) {
  const { activeSession } = useGroupingSessions();
  const { targets } = useGroupingTargets(activeSession?.id);
  const { entries } = usePSDailyEntries(activeSession?.id, userId);

  if (!activeSession) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No active session</p>
      </div>
    );
  }

  const userTarget = targets.find(t => t.target_scope === 'individual' && t.user_id === userId);
  const achievedPoints = entries.reduce((sum, e) => sum + e.reward_points, 0);
  
  const totalDays = calculateSessionDays(activeSession.start_date, activeSession.end_date);
  const daysRemaining = calculateDaysRemaining(activeSession.end_date);
  
  const targetPoints = userTarget?.target_points || 0;
  const progress = targetPoints > 0 ? Math.min(100, (achievedPoints / targetPoints) * 100) : 0;
  const status = calculateTargetStatus(achievedPoints, targetPoints, daysRemaining, totalDays);

  const statusConfig = {
    on_track: { icon: TrendingUp, class: 'bg-green-500/10 text-green-600' },
    at_risk: { icon: Minus, class: 'bg-yellow-500/10 text-yellow-600' },
    behind: { icon: TrendingDown, class: 'bg-red-500/10 text-red-600' },
  };
  const StatusIcon = statusConfig[status].icon;

  return (
    <div className="space-y-3">
      {/* Session Info */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Session</span>
        <Badge variant="outline">#{activeSession.session_number}</Badge>
      </div>

      {/* Target */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Target</span>
        <span className="font-medium">{targetPoints} pts</span>
      </div>

      {/* Achieved */}
      <div className="flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Achieved</span>
        <span className="font-medium text-primary">{achievedPoints} pts</span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-right text-muted-foreground">
          {progress.toFixed(1)}% complete
        </p>
      </div>

      {/* Status */}
      <div className="flex justify-between items-center pt-2 border-t">
        <span className="text-muted-foreground text-sm">Status</span>
        <Badge variant="outline" className={statusConfig[status].class}>
          <StatusIcon className="w-3 h-3 mr-1" />
          {TARGET_STATUS_LABELS[status]}
        </Badge>
      </div>
    </div>
  );
}

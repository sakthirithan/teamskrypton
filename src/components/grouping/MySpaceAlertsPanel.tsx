import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Target, Calendar } from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { useAuth } from '@/hooks/useAuth';
import { 
  calculateTargetStatus, 
  calculateSessionDays, 
  calculateDaysRemaining 
} from '@/lib/groupingConstants';
import { format, subDays } from 'date-fns';

interface MySpaceAlertsPanelProps {
  userId?: string;
}

export function MySpaceAlertsPanel({ userId }: MySpaceAlertsPanelProps) {
  const { user } = useAuth();
  const { activeSession } = useGroupingSessions();
  const { myTargets } = useGroupingTargets(activeSession?.id);
  const { entries, getTotalPoints, getPendingCount } = usePSDailyEntries(activeSession?.id, userId || user?.id);

  const viewingUserId = userId || user?.id;

  if (!activeSession) {
    return null;
  }

  const totalDays = calculateSessionDays(activeSession.start_date, activeSession.end_date);
  const daysRemaining = calculateDaysRemaining(activeSession.end_date);

  // Get individual target for this user
  const myIndividualTarget = myTargets.find(t => 
    t.target_scope === 'individual' && t.user_id === viewingUserId
  );

  const achievedPoints = getTotalPoints(viewingUserId);
  const pendingCount = getPendingCount(viewingUserId);

  // Calculate alerts for this individual
  const alerts: { type: 'behind' | 'pending' | 'missing' | 'deadline'; message: string }[] = [];

  // Check if behind target
  if (myIndividualTarget) {
    const status = calculateTargetStatus(
      achievedPoints, 
      myIndividualTarget.target_points, 
      daysRemaining, 
      totalDays
    );
    
    if (status === 'behind') {
      alerts.push({
        type: 'behind',
        message: `You're behind your target (${achievedPoints}/${myIndividualTarget.target_points} pts)`,
      });
    } else if (status === 'at_risk') {
      alerts.push({
        type: 'behind',
        message: `You're at risk of missing your target`,
      });
    }
  }

  // Check for pending entries
  if (pendingCount > 0) {
    alerts.push({
      type: 'pending',
      message: `You have ${pendingCount} pending ${pendingCount === 1 ? 'entry' : 'entries'} to complete`,
    });
  }

  // Check for missing entry yesterday
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const hasYesterdayEntry = entries.some(e => e.entry_date === yesterday);
  if (!hasYesterdayEntry) {
    alerts.push({
      type: 'missing',
      message: 'No PS entry for yesterday',
    });
  }

  // Check if session is ending soon
  if (daysRemaining <= 3 && daysRemaining > 0) {
    alerts.push({
      type: 'deadline',
      message: `Session ends in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
    });
  }

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Card className="border-yellow-500/20 bg-yellow-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          Your Alerts
          <Badge variant="outline" className="ml-auto bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            {alerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {alerts.map((alert, index) => (
            <div
              key={index}
              className={`flex items-start gap-2 p-2 rounded text-sm ${
                alert.type === 'behind' 
                  ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                  : alert.type === 'pending'
                  ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                  : alert.type === 'missing'
                  ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
              }`}
            >
              {alert.type === 'behind' && <Target className="w-4 h-4 mt-0.5 shrink-0" />}
              {alert.type === 'pending' && <Clock className="w-4 h-4 mt-0.5 shrink-0" />}
              {alert.type === 'missing' && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
              {alert.type === 'deadline' && <Calendar className="w-4 h-4 mt-0.5 shrink-0" />}
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

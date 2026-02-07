import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Target, Calendar, Zap } from 'lucide-react';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { useAuth } from '@/hooks/useAuth';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import {
  calculateTargetStatus,
  calculateSessionDays,
  calculateDaysRemaining
} from '@/lib/groupingConstants';

interface MySpaceAlertsPanelProps {
  userId?: string;
  isViewingOther?: boolean;
  session?: GroupingSession | null;
}

export function MySpaceAlertsPanel({ userId, isViewingOther = false, session }: MySpaceAlertsPanelProps) {
  const { user } = useAuth();
  // Use passed session (for session switching) - alerts are now session-bound
  const { myTargets } = useGroupingTargets(session?.id);
  const { getTotalPoints, getPendingCount, getAttemptCount } = usePSDailyEntries(
    session?.id,
    userId || user?.id
  );

  const viewingUserId = userId || user?.id;

  // Don't show alerts when viewing another user's workspace (read-only mode)
  if (!session || !viewingUserId || isViewingOther) return null;

  const totalDays = calculateSessionDays(
    session.start_date,
    session.end_date
  );
  const daysRemaining = calculateDaysRemaining(session.end_date);

  // Individual target
  const myIndividualTarget = myTargets.find(
    t => t.target_scope === 'individual' && t.user_id === viewingUserId
  );

  const achievedPoints = getTotalPoints(viewingUserId);
  const pendingCount = getPendingCount(viewingUserId);
  const attemptCount = getAttemptCount(viewingUserId);

  const alerts: {
    type: 'behind' | 'pending' | 'deadline' | 'attempt';
    message: string;
  }[] = [];

  // 🎯 Target status alerts
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
    }

    if (status === 'at_risk') {
      alerts.push({
        type: 'behind',
        message: `You're at risk of missing your target`,
      });
    }
  }

  // ⏳ Pending entries alert
  if (pendingCount > 0) {
    alerts.push({
      type: 'pending',
      message: `You have ${pendingCount} pending ${
        pendingCount === 1 ? 'entry' : 'entries'
      } to complete`,
    });
  }

  // ⚡ Attempt entries alert
  if (attemptCount > 0) {
    alerts.push({
      type: 'attempt',
      message: `You have ${attemptCount} attempt ${
        attemptCount === 1 ? 'entry' : 'entries'
      } (does not count toward target)`,
    });
  }

  // ⏰ Session ending soon
  if (daysRemaining <= 3 && daysRemaining > 0) {
    alerts.push({
      type: 'deadline',
      message: `Session ends in ${daysRemaining} day${
        daysRemaining > 1 ? 's' : ''
      }`,
    });
  }

  if (alerts.length === 0) return null;

  return (
    <Card className="border-yellow-500/20 bg-yellow-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          Your Alerts
          <Badge
            variant="outline"
            className="ml-auto bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
          >
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
                  : alert.type === 'attempt'
                  ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                  : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
              }`}
            >
              {alert.type === 'behind' && (
                <Target className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              {alert.type === 'pending' && (
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              {alert.type === 'attempt' && (
                <Zap className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              {alert.type === 'deadline' && (
                <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{alert.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Calendar, User } from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { 
  calculateTargetStatus, 
  calculateSessionDays, 
  calculateDaysRemaining 
} from '@/lib/groupingConstants';
import { format, subDays } from 'date-fns';

interface Profile {
  user_id: string;
  full_name: string;
}

export function GroupingAlertsPanel() {
  const { isLeadership } = useAuth();
  const queryClient = useQueryClient();
  const { activeSession } = useGroupingSessions();
  const { targets } = useGroupingTargets(activeSession?.id);
  const { entries } = usePSDailyEntries(activeSession?.id);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
    await queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
    setIsRefreshing(false);
  }, [queryClient]);

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false);
      if (error) throw error;
      return data as Profile[];
    },
  });

  if (!isLeadership || !activeSession) {
    return null;
  }

  const totalDays = calculateSessionDays(activeSession.start_date, activeSession.end_date);
  const daysRemaining = calculateDaysRemaining(activeSession.end_date);

  // Calculate alerts
  const alerts: { type: 'behind' | 'missing' | 'deadline'; message: string; user?: string }[] = [];

  // Check for users behind target
  targets.forEach((target) => {
    if (target.target_scope !== 'individual' || !target.user_id) return;
    
    const userPoints = entries
      .filter(e => e.user_id === target.user_id)
      .reduce((sum, e) => sum + e.reward_points, 0);
    
    const status = calculateTargetStatus(userPoints, target.target_points, daysRemaining, totalDays);
    
    if (status === 'behind') {
      const member = teamMembers.find(m => m.user_id === target.user_id);
      alerts.push({
        type: 'behind',
        message: `${member?.full_name || 'Unknown'} is behind target`,
        user: target.user_id,
      });
    }
  });

  // Check for missing daily entries (yesterday)
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  teamMembers.forEach((member) => {
    const hasEntry = entries.some(
      e => e.user_id === member.user_id && e.entry_date === yesterday
    );
    if (!hasEntry) {
      alerts.push({
        type: 'missing',
        message: `${member.full_name} has no entry for yesterday`,
        user: member.user_id,
      });
    }
  });

  // Check if session is ending soon
  if (daysRemaining <= 3 && daysRemaining > 0) {
    alerts.push({
      type: 'deadline',
      message: `Session ends in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-4 h-4" />
          Alerts & Risks
          <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No alerts. Everything looks good!
          </p>
        ) : (
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {alerts.slice(0, 10).map((alert, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                  alert.type === 'behind' 
                    ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                    : alert.type === 'missing'
                    ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                    : 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                }`}
              >
                {alert.type === 'behind' && <TrendingDown className="w-4 h-4 mt-0.5 shrink-0" />}
                {alert.type === 'missing' && <User className="w-4 h-4 mt-0.5 shrink-0" />}
                {alert.type === 'deadline' && <Calendar className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

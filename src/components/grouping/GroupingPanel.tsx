import { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, User, Target, TrendingUp, TrendingDown, Minus, History } from 'lucide-react';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { 
  calculateTargetStatus, 
  calculateSessionDays, 
  calculateDaysRemaining,
  TARGET_STATUS_LABELS 
} from '@/lib/groupingConstants';
import { GroupingSession } from '@/hooks/useGroupingSessions';

interface Profile {
  user_id: string;
  full_name: string;
}

interface GroupingPanelProps {
  session?: GroupingSession | null;
}

export function GroupingPanel({ session }: GroupingPanelProps) {
  const { user, isLeadership } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Use passed session (controlled by Home's SessionCard)
  const viewingSession = session;
  const isViewingHistory = viewingSession && viewingSession.status === 'closed';
  
  const { targets, myTargets } = useGroupingTargets(viewingSession?.id);
  const { entries } = usePSDailyEntries(viewingSession?.id);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['grouping-sessions'] });
    await queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
    await queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
    setIsRefreshing(false);
  }, [queryClient]);

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-names'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!user,
  });

  const getMemberName = (userId: string | null) => {
    if (!userId) return 'Group';
    return teamMembers.find(m => m.user_id === userId)?.full_name || 'Unknown';
  };

  // Calculate user's achieved points from COMPLETED entries only
  const getUserAchievedPoints = (userId: string | null) => {
    if (!userId) {
      // Group target - sum all completed entries
      return entries
        .filter(e => e.status === 'completed')
        .reduce((sum, e) => sum + e.reward_points, 0);
    }
    return entries
      .filter(e => e.user_id === userId && e.status === 'completed')
      .reduce((sum, e) => sum + e.reward_points, 0);
  };

  const displayTargets = isLeadership ? targets : myTargets;

  const totalDays = viewingSession 
    ? calculateSessionDays(viewingSession.start_date, viewingSession.end_date)
    : 0;
  const daysRemaining = viewingSession 
    ? calculateDaysRemaining(viewingSession.end_date)
    : 0;

  const getStatusBadge = (achieved: number, target: number) => {
    const status = calculateTargetStatus(achieved, target, daysRemaining, totalDays);
    const statusConfig = {
      on_track: { icon: TrendingUp, class: 'bg-green-500/10 text-green-600 border-green-500/20' },
      at_risk: { icon: Minus, class: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' },
      behind: { icon: TrendingDown, class: 'bg-red-500/10 text-red-600 border-red-500/20' },
    };
    const config = statusConfig[status];
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className={config.class}>
        <Icon className="w-3 h-3 mr-1" />
        {TARGET_STATUS_LABELS[status]}
      </Badge>
    );
  };

  if (!viewingSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Grouping Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No active session</p>
            <p className="text-sm">Wait for leadership to create a session.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            {viewingSession && (
              <>Session #{viewingSession.session_number}: {viewingSession.name}</>
            )}
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          </span>
          <div className="flex items-center gap-2">
            {/* Session is controlled from Home's SessionCard - no local selector */}
            {isViewingHistory ? (
              <Badge variant="secondary">
                Closed
              </Badge>
            ) : viewingSession ? (
              <Badge variant="secondary">
                {daysRemaining} days left
              </Badge>
            ) : null}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isViewingHistory && (
          <div className="mb-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <History className="w-4 h-4 inline mr-2" />
            Session is controlled from Home. Targets update automatically.
          </div>
        )}
        
        {displayTargets.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>No targets assigned yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayTargets.map((target) => {
              const achievedPoints = getUserAchievedPoints(target.user_id);
              const progress = target.target_points > 0 
                ? Math.min(100, (achievedPoints / target.target_points) * 100)
                : 0;

              return (
                <div
                  key={target.id}
                  className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {target.target_scope === 'group' ? (
                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                          <Users className="w-4 h-4 text-blue-500" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-green-500" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">
                          {target.target_scope === 'group' 
                            ? 'Group Target' 
                            : getMemberName(target.user_id)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {target.target_scope === 'group' ? 'Whole Team' : 'Individual'}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(achievedPoints, target.target_points)}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">
                        {achievedPoints} / {target.target_points} pts
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-right text-muted-foreground">
                      {progress.toFixed(1)}% complete
                    </p>
                  </div>

                  {target.notes && (
                    <p className="mt-2 text-xs text-muted-foreground italic">
                      {target.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

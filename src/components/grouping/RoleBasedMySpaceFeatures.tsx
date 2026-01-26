import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Target, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Users,
  ArrowRight,
  Star,
  Activity,
  BarChart3,
  Shield
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, isToday } from 'date-fns';
import { 
  calculateTargetStatus, 
  calculateSessionDays, 
  calculateDaysRemaining 
} from '@/lib/groupingConstants';

interface RoleBasedMySpaceFeaturesProps {
  session: GroupingSession | null;
  userId?: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

export function RoleBasedMySpaceFeatures({ session, userId }: RoleBasedMySpaceFeaturesProps) {
  const { user, role, isLeadership, isCaptainOrVice } = useAuth();
  const viewingUserId = userId || user?.id;
  
  const { targets, myTargets } = useGroupingTargets(session?.id);
  const { entries, getTotalPoints, getPendingCount } = usePSDailyEntries(session?.id, viewingUserId);

  // Fetch all members for lead features
  const { data: allMembers = [] } = useQuery({
    queryKey: ['all-members-role-features'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isLeadership,
  });

  // Fetch all entries for leads
  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-ps-entries-role', session?.id],
    queryFn: async () => {
      if (!session?.id) return [];
      const { data, error } = await supabase
        .from('ps_daily_entries')
        .select('*')
        .eq('session_id', session.id)
        .eq('is_test', false);
      if (error) throw error;
      return data;
    },
    enabled: isLeadership && !!session?.id,
  });

  // Calculate role-specific metrics
  const roleMetrics = useMemo(() => {
    if (!session) return null;

    const totalDays = calculateSessionDays(session.start_date, session.end_date);
    const daysRemaining = calculateDaysRemaining(session.end_date);
    const myIndividualTarget = myTargets.find(t => t.target_scope === 'individual' && t.user_id === viewingUserId);
    const groupTarget = myTargets.find(t => t.target_scope === 'group');
    const achievedPoints = getTotalPoints(viewingUserId);
    const pendingCount = getPendingCount(viewingUserId);

    // Member-specific
    const todayEntries = entries.filter(e => isToday(new Date(e.entry_date)));
    const targetStatus = myIndividualTarget 
      ? calculateTargetStatus(achievedPoints, myIndividualTarget.target_points, daysRemaining, totalDays)
      : null;

    // Lead-specific
    const atRiskMembers = allMembers.filter(member => {
      const memberTarget = targets.find(t => t.target_scope === 'individual' && t.user_id === member.user_id);
      if (!memberTarget) return false;
      const memberEntries = allEntries.filter(e => e.user_id === member.user_id && e.status === 'completed');
      const memberPoints = memberEntries.reduce((sum, e) => sum + e.reward_points, 0);
      const status = calculateTargetStatus(memberPoints, memberTarget.target_points, daysRemaining, totalDays);
      return status === 'behind' || status === 'at_risk';
    });

    const totalPending = allEntries.filter(e => e.status === 'pending').length;
    const totalCompleted = allEntries.filter(e => e.status === 'completed').length;
    const completionRate = allEntries.length > 0 ? Math.round((totalCompleted / allEntries.length) * 100) : 0;

    // Group health score (for TL)
    const groupHealthScore = groupTarget && groupTarget.target_points > 0
      ? Math.min(100, Math.round((groupTarget.achieved_points / groupTarget.target_points) * 100))
      : 0;

    return {
      todayEntries,
      targetStatus,
      pendingCount,
      achievedPoints,
      myIndividualTarget,
      groupTarget,
      atRiskMembers,
      totalPending,
      totalCompleted,
      completionRate,
      groupHealthScore,
      daysRemaining,
      totalDays,
    };
  }, [session, entries, targets, myTargets, allEntries, allMembers, viewingUserId, getTotalPoints, getPendingCount]);

  if (!session || !roleMetrics) return null;

  // Team Member Features
  if (role === 'team_member') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="w-4 h-4 text-yellow-500" />
            Today's Focus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Today's Target Summary */}
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Today's Entries</span>
              <Badge variant="outline">{roleMetrics.todayEntries.length}</Badge>
            </div>
            {roleMetrics.myIndividualTarget && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {roleMetrics.achievedPoints} / {roleMetrics.myIndividualTarget.target_points} pts
                </span>
              </div>
            )}
          </div>

          {/* Pending Count */}
          {roleMetrics.pendingCount > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  {roleMetrics.pendingCount} Pending Entries
                </p>
                <p className="text-xs text-muted-foreground">
                  Mark as completed to add to your target
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-yellow-600" />
            </div>
          )}

          {/* Next Action Hint */}
          <div className="p-3 rounded-lg border bg-background">
            <p className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Next Action
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {roleMetrics.pendingCount > 0
                ? 'Complete your pending entries to update progress'
                : roleMetrics.todayEntries.length === 0
                ? 'Add your first PS entry for today'
                : 'Keep up the momentum! Add more entries.'
              }
            </p>
          </div>

          {/* Target Status Badge */}
          {roleMetrics.targetStatus && (
            <div className={`p-3 rounded-lg ${
              roleMetrics.targetStatus === 'on_track' 
                ? 'bg-green-500/10 border border-green-500/20' 
                : roleMetrics.targetStatus === 'at_risk'
                ? 'bg-yellow-500/10 border border-yellow-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}>
              <div className="flex items-center gap-2">
                {roleMetrics.targetStatus === 'on_track' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : roleMetrics.targetStatus === 'at_risk' ? (
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
                <span className={`font-medium ${
                  roleMetrics.targetStatus === 'on_track' 
                    ? 'text-green-700 dark:text-green-400' 
                    : roleMetrics.targetStatus === 'at_risk'
                    ? 'text-yellow-700 dark:text-yellow-400'
                    : 'text-red-700 dark:text-red-400'
                }`}>
                  {roleMetrics.targetStatus === 'on_track' 
                    ? "You're on track!" 
                    : roleMetrics.targetStatus === 'at_risk'
                    ? 'At risk - Pick up the pace'
                    : 'Behind schedule - Action needed'
                  }
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Lead Features (VC, TM, Strategist)
  if (isLeadership && !isCaptainOrVice) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-blue-500" />
            Quick Actions & Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Team Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-green-600">{roleMetrics.completionRate}%</p>
              <p className="text-xs text-muted-foreground">Completion Rate</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-2xl font-bold text-yellow-600">{roleMetrics.totalPending}</p>
              <p className="text-xs text-muted-foreground">Pending Entries</p>
            </div>
          </div>

          {/* At-Risk Indicator */}
          {roleMetrics.atRiskMembers.length > 0 && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="font-medium text-red-700 dark:text-red-400">
                  {roleMetrics.atRiskMembers.length} At-Risk Members
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {roleMetrics.atRiskMembers.slice(0, 3).map(member => (
                  <Badge key={member.user_id} variant="outline" className="text-xs">
                    {member.full_name.split(' ')[0]}
                  </Badge>
                ))}
                {roleMetrics.atRiskMembers.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{roleMetrics.atRiskMembers.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Days Remaining */}
          <div className="p-3 rounded-lg border bg-background">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Session Progress</span>
              <span className="text-sm font-medium">
                {roleMetrics.daysRemaining} days left
              </span>
            </div>
            <Progress 
              value={((roleMetrics.totalDays - roleMetrics.daysRemaining) / roleMetrics.totalDays) * 100} 
              className="h-2" 
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Team Leader (TL) Features
  if (isCaptainOrVice) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-primary" />
            Leadership Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Group Health Score */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Group Health Score</span>
              <span className={`text-2xl font-bold ${
                roleMetrics.groupHealthScore >= 70 ? 'text-green-600' :
                roleMetrics.groupHealthScore >= 40 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {roleMetrics.groupHealthScore}%
              </span>
            </div>
            <Progress value={roleMetrics.groupHealthScore} className="h-3" />
            {roleMetrics.groupTarget && (
              <p className="text-xs text-muted-foreground mt-2">
                Group: {roleMetrics.groupTarget.achieved_points} / {roleMetrics.groupTarget.target_points} pts
              </p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold">{roleMetrics.totalCompleted}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold text-yellow-600">{roleMetrics.totalPending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <p className="text-lg font-bold text-red-600">{roleMetrics.atRiskMembers.length}</p>
              <p className="text-xs text-muted-foreground">At Risk</p>
            </div>
          </div>

          {/* At-Risk Members List */}
          {roleMetrics.atRiskMembers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                At-Risk Members
              </p>
              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                {roleMetrics.atRiskMembers.map(member => (
                  <div 
                    key={member.user_id}
                    className="p-2 rounded bg-red-500/5 border border-red-500/10 text-sm flex items-center justify-between"
                  >
                    <span>{member.full_name}</span>
                    <Badge variant="destructive" className="text-xs">Behind</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion Projection */}
          <div className="p-3 rounded-lg border bg-background">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Completion Projection</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {roleMetrics.completionRate >= 80 
                ? 'On track for successful session completion'
                : roleMetrics.completionRate >= 50
                ? 'Moderate progress - may need intervention'
                : 'Significant action required to meet targets'
              }
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

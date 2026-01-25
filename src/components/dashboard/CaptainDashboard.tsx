import { memo, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Clock, AlertCircle, CheckCircle, Users, Activity, TrendingUp, BarChart3 } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { Progress } from '@/components/ui/progress';

interface Approval {
  id: string;
  approval_type: string;
  status: string;
  created_at: string;
  reason?: string | null;
  target_user_id?: string | null;
}

interface Task {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  deadline: string;
}

interface TeamMember {
  user_id: string;
  full_name: string;
  role: string | null;
}

interface CaptainDashboardProps {
  tasks: Task[];
  members: TeamMember[];
  approvals: Approval[];
  recentActions: Array<{
    id: string;
    action: string;
    created_at: string;
    user_name?: string;
    task_title?: string;
  }>;
}

export const CaptainDashboard = memo(function CaptainDashboard({ 
  tasks, 
  members,
  approvals,
  recentActions,
  onRefresh
}: CaptainDashboardProps & { onRefresh?: () => Promise<void> }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  }, [onRefresh]);
  // Escalation Monitor - unresolved pending tasks & approval bottlenecks
  const escalations = useMemo(() => {
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const pendingApprovals = approvals.filter(a => a.status === 'pending');
    
    return {
      pendingTasks: pendingTasks.slice(0, 5),
      pendingApprovals: pendingApprovals.slice(0, 5),
      totalPending: pendingTasks.length + pendingApprovals.length
    };
  }, [tasks, approvals]);

  // Stats
  const stats = useMemo(() => {
    const activeMembers = new Set(
      tasks.filter(t => t.status === 'working').map(t => t.assigned_to)
    ).size;
    const completedToday = tasks.filter(t => {
      if (t.status !== 'completed') return false;
      return true; // Simplified - would need completed_at field
    }).length;
    
    return {
      totalMembers: members.length,
      activeMembers,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      completedToday
    };
  }, [tasks, members]);

  const getMemberName = (userId: string | null) => {
    if (!userId) return 'Unknown';
    const member = members.find(m => m.user_id === userId);
    return member?.full_name || 'Unknown';
  };

  // Team Performance Rate
  const performanceRate = useMemo(() => {
    const completed = tasks.filter(t => t.status === 'completed').length;
    const total = tasks.length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [tasks]);

  // Overdue tasks count
  const overdueTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter(t => {
      if (t.status === 'completed') return false;
      return differenceInHours(new Date(t.deadline), now) < 0;
    }).length;
  }, [tasks]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <Shield className="w-5 h-5 text-[hsl(var(--role-captain))]" />
          Authority Center
          <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          {escalations.totalPending > 0 && (
            <Badge className="bg-[hsl(var(--status-pending))]/15 text-[hsl(var(--status-pending))] ml-2">
              {escalations.totalPending} Escalations
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-5 gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-center">
            <Users className="w-4 h-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{stats.totalMembers}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Team</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-working))]/10 text-center">
            <Activity className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-working))]" />
            <p className="text-lg font-bold text-[hsl(var(--status-working))]">{stats.activeMembers}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Active</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-pending))]/10 text-center">
            <AlertCircle className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-pending))]" />
            <p className="text-lg font-bold text-[hsl(var(--status-pending))]">{stats.pendingTasks}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-completed))]/10 text-center">
            <CheckCircle className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-completed))]" />
            <p className="text-lg font-bold text-[hsl(var(--status-completed))]">{stats.completedToday}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Done</p>
          </div>
          <div className="p-2 rounded-lg bg-destructive/10 text-center">
            <Clock className="w-4 h-4 mx-auto mb-1 text-destructive" />
            <p className="text-lg font-bold text-destructive">{overdueTasks}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Overdue</p>
          </div>
        </div>

        {/* Team Performance */}
        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Team Performance</span>
            </div>
            <span className="text-sm font-bold">{performanceRate}%</span>
          </div>
          <Progress value={performanceRate} className="h-2" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-primary/10 text-center">
            <Users className="w-4 h-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{stats.totalMembers}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Team</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-working))]/10 text-center">
            <Activity className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-working))]" />
            <p className="text-lg font-bold text-[hsl(var(--status-working))]">{stats.activeMembers}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Active</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-pending))]/10 text-center">
            <AlertCircle className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-pending))]" />
            <p className="text-lg font-bold text-[hsl(var(--status-pending))]">{stats.pendingTasks}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-completed))]/10 text-center">
            <CheckCircle className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-completed))]" />
            <p className="text-lg font-bold text-[hsl(var(--status-completed))]">{stats.completedToday}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Done</p>
          </div>
        </div>

        {/* Escalation Monitor */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-[hsl(var(--status-pending))]" />
            <h4 className="text-sm font-medium">Escalation Monitor</h4>
          </div>
          <div className="space-y-2 max-h-36 overflow-y-auto">
            {escalations.totalPending === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded">
                No escalations - system running smoothly
              </p>
            ) : (
              <>
                {escalations.pendingTasks.map(task => (
                  <div key={task.id} className="p-2 rounded border border-[hsl(var(--status-pending))]/30 bg-[hsl(var(--status-pending))]/5">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {getMemberName(task.assigned_to)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">Task Pending</Badge>
                    </div>
                  </div>
                ))}
                {escalations.pendingApprovals.map(approval => (
                  <div key={approval.id} className="p-2 rounded border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {approval.approval_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(approval.created_at), 'MMM dd, HH:mm')}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">Approval</Badge>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Authority Timeline - Recent Leadership Actions */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Authority Timeline</h4>
          </div>
          <ScrollArea className="h-32">
            <div className="space-y-2">
              {recentActions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded">
                  No recent actions
                </p>
              ) : (
                recentActions.slice(0, 8).map(action => (
                  <div key={action.id} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs">
                        <span className="font-medium">{action.user_name}</span>
                        {' '}{action.action.toLowerCase()}
                        {action.task_title && <span className="text-muted-foreground"> • {action.task_title}</span>}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(action.created_at), 'HH:mm')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
});

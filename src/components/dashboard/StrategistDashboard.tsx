import { memo, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Radar, AlertTriangle, TrendingDown, Clock, Target, Lightbulb, PieChart } from 'lucide-react';
import { format, differenceInHours, differenceInDays } from 'date-fns';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
interface Task {
  id: string;
  title: string;
  status: string;
  deadline: string;
  assigned_to: string | null;
  duration_minutes: number | null;
  created_at: string;
}

interface TeamMember {
  user_id: string;
  full_name: string;
  role: string | null;
}

interface StrategistDashboardProps {
  tasks: Task[];
  members: TeamMember[];
}

export const StrategistDashboard = memo(function StrategistDashboard({ 
  tasks, 
  members,
  onRefresh
}: StrategistDashboardProps & { onRefresh?: () => Promise<void> }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  }, [onRefresh]);
  // Task Risk Radar - tasks nearing deadlines
  const riskTasks = useMemo(() => {
    const now = new Date();
    return tasks
      .filter(t => {
        if (t.status === 'completed') return false;
        const deadline = new Date(t.deadline);
        const hoursLeft = differenceInHours(deadline, now);
        return hoursLeft <= 24 && hoursLeft > -48; // Within 24 hours or up to 48 hours overdue
      })
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      .slice(0, 8);
  }, [tasks]);

  // Frequently pending tasks (bottleneck detection)
  const bottlenecks = useMemo(() => {
    const memberTaskCount = new Map<string, { pending: number; total: number; name: string }>();
    
    tasks.forEach(task => {
      if (!task.assigned_to) return;
      const member = members.find(m => m.user_id === task.assigned_to);
      if (!member) return;
      
      const current = memberTaskCount.get(task.assigned_to) || { pending: 0, total: 0, name: member.full_name };
      current.total++;
      if (task.status === 'pending') current.pending++;
      memberTaskCount.set(task.assigned_to, current);
    });

    return Array.from(memberTaskCount.entries())
      .filter(([_, data]) => data.pending > 0)
      .sort((a, b) => b[1].pending - a[1].pending)
      .slice(0, 5)
      .map(([userId, data]) => ({ userId, ...data }));
  }, [tasks, members]);

  // Stats
  const stats = useMemo(() => {
    const total = tasks.length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const working = tasks.filter(t => t.status === 'working').length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const atRisk = riskTasks.length;

    return { total, pending, working, completed, atRisk };
  }, [tasks, riskTasks]);

  // Trend analysis - completion rate last 7 days vs overall
  const trendAnalysis = useMemo(() => {
    const now = new Date();
    const recentTasks = tasks.filter(t => {
      if (!t.created_at) return false;
      return differenceInDays(now, new Date(t.created_at)) <= 7;
    });
    const recentCompleted = recentTasks.filter(t => t.status === 'completed').length;
    const recentRate = recentTasks.length > 0 ? (recentCompleted / recentTasks.length) * 100 : 0;
    const overallRate = tasks.length > 0 ? (stats.completed / stats.total) * 100 : 0;
    const trend = recentRate - overallRate;
    return { recentRate: Math.round(recentRate), trend: Math.round(trend) };
  }, [tasks, stats]);

  const getMemberName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const member = members.find(m => m.user_id === userId);
    return member?.full_name || 'Unknown';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <Radar className="w-5 h-5 text-[hsl(var(--role-strategist))]" />
          Strategic Overview
          <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          {stats.atRisk > 0 && (
            <Badge className="bg-[hsl(var(--status-pending))]/15 text-[hsl(var(--status-pending))] ml-2">
              {stats.atRisk} At Risk
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-working))]/10 text-center">
            <p className="text-lg font-bold text-[hsl(var(--status-working))]">{stats.working}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Active</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-completed))]/10 text-center">
            <p className="text-lg font-bold text-[hsl(var(--status-completed))]">{stats.completed}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Done</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-pending))]/10 text-center">
            <p className="text-lg font-bold text-[hsl(var(--status-pending))]">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
          </div>
        </div>

        {/* Trend Insight */}
        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium">7-Day Trend</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Completion Rate</span>
            <div className="flex items-center gap-2">
              <span className="font-bold">{trendAnalysis.recentRate}%</span>
              <Badge variant="outline" className={
                trendAnalysis.trend > 0 ? 'text-green-600 border-green-500/30' :
                trendAnalysis.trend < 0 ? 'text-red-600 border-red-500/30' : ''
              }>
                {trendAnalysis.trend > 0 ? '+' : ''}{trendAnalysis.trend}%
              </Badge>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-lg font-bold">{stats.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-working))]/10 text-center">
            <p className="text-lg font-bold text-[hsl(var(--status-working))]">{stats.working}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Active</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-completed))]/10 text-center">
            <p className="text-lg font-bold text-[hsl(var(--status-completed))]">{stats.completed}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Done</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-pending))]/10 text-center">
            <p className="text-lg font-bold text-[hsl(var(--status-pending))]">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
          </div>
        </div>

        {/* Task Risk Radar */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-[hsl(var(--status-pending))]" />
            <h4 className="text-sm font-medium">Task Risk Radar</h4>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {riskTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded">
                No immediate risks detected
              </p>
            ) : (
              riskTasks.map(task => {
                const hoursLeft = differenceInHours(new Date(task.deadline), new Date());
                const isOverdue = hoursLeft < 0;
                
                return (
                  <div key={task.id} className={`p-2 rounded border ${isOverdue ? 'border-destructive/50 bg-destructive/5' : 'border-[hsl(var(--status-pending))]/30 bg-[hsl(var(--status-pending))]/5'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {getMemberName(task.assigned_to)}
                        </p>
                      </div>
                      <Badge variant="outline" className={`text-xs ${isOverdue ? 'border-destructive text-destructive' : ''}`}>
                        <Clock className="w-3 h-3 mr-1" />
                        {isOverdue ? `${Math.abs(hoursLeft)}h overdue` : `${hoursLeft}h left`}
                      </Badge>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bottleneck Detector */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Bottleneck Detector</h4>
          </div>
          <div className="space-y-2">
            {bottlenecks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded">
                No bottlenecks detected
              </p>
            ) : (
              bottlenecks.map(item => {
                const pendingRate = Math.round((item.pending / item.total) * 100);
                return (
                  <div key={item.userId} className="p-2 rounded border bg-muted/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.pending}/{item.total} pending
                      </span>
                    </div>
                    <Progress value={pendingRate} className="h-1.5" />
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

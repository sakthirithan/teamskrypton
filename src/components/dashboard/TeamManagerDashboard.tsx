import { memo, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LayoutGrid, Users, Activity, BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
interface Task {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
}

interface TeamMember {
  user_id: string;
  full_name: string;
  role: string | null;
}

interface TeamManagerDashboardProps {
  tasks: Task[];
  members: TeamMember[];
}

export const TeamManagerDashboard = memo(function TeamManagerDashboard({ 
  tasks, 
  members,
  onRefresh
}: TeamManagerDashboardProps & { onRefresh?: () => Promise<void> }) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  }, [onRefresh]);
  // Execution Heatmap - working, idle, pending per member
  const heatmapData = useMemo(() => {
    const memberStats = new Map<string, { 
      name: string; 
      working: number; 
      idle: number; 
      pending: number; 
      completed: number;
      total: number;
    }>();

    // Initialize all members
    members.forEach(m => {
      memberStats.set(m.user_id, {
        name: m.full_name,
        working: 0,
        idle: 0,
        pending: 0,
        completed: 0,
        total: 0
      });
    });

    // Count tasks per member
    tasks.forEach(task => {
      if (!task.assigned_to) return;
      const stats = memberStats.get(task.assigned_to);
      if (!stats) return;
      
      stats.total++;
      switch (task.status) {
        case 'working': stats.working++; break;
        case 'idle': stats.idle++; break;
        case 'pending': stats.pending++; break;
        case 'completed': stats.completed++; break;
      }
    });

    return Array.from(memberStats.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [tasks, members]);

  // Workload Balance View
  const workloadBalance = useMemo(() => {
    const totalTasks = tasks.filter(t => t.status !== 'completed').length;
    const avgLoad = members.length > 0 ? totalTasks / members.length : 0;
    
    return heatmapData.map(m => {
      const activeTasks = m.working + m.idle + m.pending;
      const deviation = avgLoad > 0 ? ((activeTasks - avgLoad) / avgLoad) * 100 : 0;
      return {
        ...m,
        activeTasks,
        deviation,
        isOverloaded: deviation > 50,
        isUnderloaded: deviation < -50
      };
    }).filter(m => m.total > 0);
  }, [heatmapData, tasks, members]);

  // Overall stats
  const stats = useMemo(() => {
    const working = tasks.filter(t => t.status === 'working').length;
    const idle = tasks.filter(t => t.status === 'idle').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const activeMembers = new Set(tasks.filter(t => t.status === 'working').map(t => t.assigned_to)).size;

    return { working, idle, pending, activeMembers, totalMembers: members.length };
  }, [tasks, members]);

  // Quick assignment suggestions
  const assignmentSuggestions = useMemo(() => {
    return workloadBalance
      .filter(m => m.isUnderloaded && m.activeTasks < 2)
      .slice(0, 3)
      .map(m => m.name);
  }, [workloadBalance]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <LayoutGrid className="w-5 h-5 text-[hsl(var(--role-manager))]" />
          Coordination Center
          <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          <Badge variant="secondary" className="ml-2">
            <Users className="w-3 h-3 mr-1" />
            {stats.activeMembers}/{stats.totalMembers} Active
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-[hsl(var(--status-working))]/10 text-center">
            <Activity className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-working))]" />
            <p className="text-lg font-bold text-[hsl(var(--status-working))]">{stats.working}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Working</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-lg font-bold">{stats.idle}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Idle</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-pending))]/10 text-center">
            <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-pending))]" />
            <p className="text-lg font-bold text-[hsl(var(--status-pending))]">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
          </div>
          <div className="p-2 rounded-lg bg-primary/10 text-center">
            <TrendingUp className="w-4 h-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{workloadBalance.filter(m => m.isOverloaded).length}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Overload</p>
          </div>
        </div>

        {/* Quick Suggestions */}
        {assignmentSuggestions.length > 0 && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
              Available for tasks:
            </p>
            <p className="text-sm">{assignmentSuggestions.join(', ')}</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-[hsl(var(--status-working))]/10 text-center">
            <Activity className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-working))]" />
            <p className="text-lg font-bold text-[hsl(var(--status-working))]">{stats.working}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Working</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-lg font-bold">{stats.idle}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Idle</p>
          </div>
          <div className="p-2 rounded-lg bg-[hsl(var(--status-pending))]/10 text-center">
            <p className="text-lg font-bold text-[hsl(var(--status-pending))]">{stats.pending}</p>
            <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
          </div>
        </div>

        {/* Execution Heatmap */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Execution Heatmap</h4>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {heatmapData.filter(m => m.total > 0).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-3 bg-muted/30 rounded">
                No task data available
              </p>
            ) : (
              heatmapData.filter(m => m.total > 0).map(item => (
                <div key={item.userId} className="p-2 rounded border bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    <div className="flex gap-1">
                      {item.working > 0 && (
                        <span className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-[hsl(var(--status-working))]/20 text-[hsl(var(--status-working))]">
                          {item.working}
                        </span>
                      )}
                      {item.idle > 0 && (
                        <span className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-muted">
                          {item.idle}
                        </span>
                      )}
                      {item.pending > 0 && (
                        <span className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-[hsl(var(--status-pending))]/20 text-[hsl(var(--status-pending))]">
                          {item.pending}
                        </span>
                      )}
                      {item.completed > 0 && (
                        <span className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-[hsl(var(--status-completed))]/20 text-[hsl(var(--status-completed))]">
                          {item.completed}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Visual bar */}
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                    {item.working > 0 && (
                      <div 
                        className="bg-[hsl(var(--status-working))]" 
                        style={{ width: `${(item.working / item.total) * 100}%` }} 
                      />
                    )}
                    {item.idle > 0 && (
                      <div 
                        className="bg-muted-foreground/30" 
                        style={{ width: `${(item.idle / item.total) * 100}%` }} 
                      />
                    )}
                    {item.pending > 0 && (
                      <div 
                        className="bg-[hsl(var(--status-pending))]" 
                        style={{ width: `${(item.pending / item.total) * 100}%` }} 
                      />
                    )}
                    {item.completed > 0 && (
                      <div 
                        className="bg-[hsl(var(--status-completed))]" 
                        style={{ width: `${(item.completed / item.total) * 100}%` }} 
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Workload Balance */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">Workload Balance</h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {workloadBalance.slice(0, 6).map(item => (
              <div 
                key={item.userId} 
                className={`p-2 rounded border text-center ${
                  item.isOverloaded ? 'border-[hsl(var(--status-pending))]/50 bg-[hsl(var(--status-pending))]/5' :
                  item.isUnderloaded ? 'border-[hsl(var(--status-completed))]/50 bg-[hsl(var(--status-completed))]/5' :
                  'bg-muted/30'
                }`}
              >
                <p className="text-sm font-medium truncate">{item.name.split(' ')[0]}</p>
                <p className={`text-lg font-bold ${
                  item.isOverloaded ? 'text-[hsl(var(--status-pending))]' :
                  item.isUnderloaded ? 'text-[hsl(var(--status-completed))]' : ''
                }`}>
                  {item.activeTasks}
                </p>
                <p className="text-[10px] text-muted-foreground">tasks</p>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 pt-2 border-t text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-working))]" /> Working
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" /> Idle
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-pending))]" /> Pending
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-completed))]" /> Done
          </span>
        </div>
      </CardContent>
    </Card>
  );
});

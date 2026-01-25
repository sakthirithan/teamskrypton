import { memo, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, CheckCircle, Clock, AlertTriangle, Award } from 'lucide-react';
import { format, isToday, startOfDay, endOfDay } from 'date-fns';
import { RefreshButton } from '@/components/ui/RefreshIconButton';

interface Task {
  id: string;
  title: string;
  status: string;
  deadline: string;
  accepted_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
}

interface TeamMemberDashboardProps {
  tasks: Task[];
  userId: string;
  onRefresh?: () => Promise<void>;
}

export const TeamMemberDashboard = memo(function TeamMemberDashboard({ 
  tasks,
  onRefresh
}: TeamMemberDashboardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    await onRefresh();
    setIsRefreshing(false);
  }, [onRefresh]);

  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const assigned = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.filter(t => t.status === 'pending').length;
    const working = tasks.filter(t => t.status === 'working').length;
    const idle = tasks.filter(t => t.status === 'idle').length;

    const todayTasks = tasks.filter(t => {
      const deadline = new Date(t.deadline);
      return deadline >= todayStart && deadline <= todayEnd;
    });

    const completedToday = tasks.filter(t => {
      if (!t.completed_at) return false;
      return isToday(new Date(t.completed_at));
    }).length;

    let focusStatus: 'untouched' | 'in_progress' | 'completed' = 'untouched';
    if (completedToday > 0 && working === 0 && todayTasks.every(t => t.status === 'completed')) {
      focusStatus = 'completed';
    } else if (working > 0 || completedToday > 0) {
      focusStatus = 'in_progress';
    }

    const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

    return { assigned, completed, pending, working, idle, completedToday, focusStatus, completionRate, todayTasks: todayTasks.length };
  }, [tasks]);

  // Streak calculation
  const streak = useMemo(() => {
    let currentStreak = 0;
    const completedDates = tasks
      .filter(t => t.completed_at)
      .map(t => format(new Date(t.completed_at!), 'yyyy-MM-dd'))
      .sort()
      .reverse();
    
    const uniqueDates = [...new Set(completedDates)];
    
    for (let i = 0; i < Math.min(uniqueDates.length, 30); i++) {
      const expectedDate = format(
        new Date(new Date().setDate(new Date().getDate() - i)),
        'yyyy-MM-dd'
      );
      const yesterdayDate = format(
        new Date(new Date().setDate(new Date().getDate() - 1)),
        'yyyy-MM-dd'
      );
      
      if (uniqueDates.includes(expectedDate)) {
        currentStreak++;
      } else if (i === 0 && uniqueDates.includes(yesterdayDate)) {
        continue;
      } else {
        break;
      }
    }
    return currentStreak;
  }, [tasks]);

  const timeline = useMemo(() => {
    return [...tasks]
      .filter(t => t.accepted_at || t.completed_at)
      .sort((a, b) => {
        const dateA = new Date(a.completed_at || a.accepted_at || a.deadline);
        const dateB = new Date(b.completed_at || b.accepted_at || b.deadline);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10);
  }, [tasks]);

  const focusConfig = {
    untouched: { label: 'Untouched', color: 'bg-muted text-muted-foreground', icon: Clock },
    in_progress: { label: 'In Progress', color: 'bg-[hsl(var(--status-working))]/15 text-[hsl(var(--status-working))]', icon: Target },
    completed: { label: 'Completed', color: 'bg-[hsl(var(--status-completed))]/15 text-[hsl(var(--status-completed))]', icon: CheckCircle },
  };

  const focus = focusConfig[stats.focusStatus];
  const FocusIcon = focus.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg font-display">
          <span className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            My Execution Dashboard
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
          </span>
          <Badge className={focus.color}>
            <FocusIcon className="w-3 h-3 mr-1" />
            {focus.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Performance Summary with Streak */}
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-2xl font-bold">{stats.assigned}</p>
            <p className="text-xs text-muted-foreground">Assigned</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(var(--status-completed))]/10 text-center">
            <p className="text-2xl font-bold text-[hsl(var(--status-completed))]">{stats.completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <div className="p-3 rounded-lg bg-[hsl(var(--status-pending))]/10 text-center">
            <p className="text-2xl font-bold text-[hsl(var(--status-pending))]">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 text-center">
            <Award className="w-4 h-4 mx-auto mb-1 text-yellow-500" />
            <p className="text-xl font-bold text-yellow-600">{streak}</p>
            <p className="text-xs text-muted-foreground">Streak</p>
          </div>
        </div>

        {/* Completion Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Completion Rate</span>
            <span className="font-medium">{stats.completionRate}%</span>
          </div>
          <Progress value={stats.completionRate} className="h-2" />
        </div>

        {/* Today's Progress */}
        <div className="p-3 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Today's Focus</span>
            <Badge variant="outline" className="text-xs">
              {stats.completedToday}/{stats.todayTasks} done
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {stats.working > 0 && (
              <Badge className="status-badge status-working">
                <Clock className="w-3 h-3 mr-1" />
                {stats.working} Working
              </Badge>
            )}
            {stats.pending > 0 && (
              <Badge className="bg-[hsl(var(--status-pending))]/15 text-[hsl(var(--status-pending))]">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {stats.pending} Pending
              </Badge>
            )}
            {stats.idle > 0 && (
              <Badge variant="secondary">
                {stats.idle} Idle
              </Badge>
            )}
          </div>
        </div>

        {/* Execution Timeline */}
        <div>
          <h4 className="text-sm font-medium mb-2">Recent Activity</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
            ) : (
              timeline.map(task => (
                <div key={task.id} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
                  <div className={`w-2 h-2 rounded-full ${
                    task.status === 'completed' ? 'bg-[hsl(var(--status-completed))]' :
                    task.status === 'working' ? 'bg-[hsl(var(--status-working))]' :
                    task.status === 'pending' ? 'bg-[hsl(var(--status-pending))]' :
                    'bg-muted-foreground'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.completed_at 
                        ? `Completed ${format(new Date(task.completed_at), 'MMM dd, HH:mm')}`
                        : task.accepted_at 
                          ? `Started ${format(new Date(task.accepted_at), 'MMM dd, HH:mm')}`
                          : `Due ${format(new Date(task.deadline), 'MMM dd, HH:mm')}`
                      }
                    </p>
                  </div>
                  {task.duration_minutes && (
                    <span className="text-xs text-muted-foreground">{task.duration_minutes}m</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
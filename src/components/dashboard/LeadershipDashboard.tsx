import { memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  Target,
  Activity
} from 'lucide-react';

interface Task {
  id: string;
  status: string;
  assigned_to: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
}

interface TeamMember {
  user_id: string;
  full_name: string;
  role: string | null;
}

interface LeadershipDashboardProps {
  tasks: Task[];
  members: TeamMember[];
}

interface QuickStat {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color: string;
}

/**
 * Leadership Dashboard - Quick stats and team overview for TL/VC
 * Displays key metrics at a glance with performance optimizations
 */
export const LeadershipDashboard = memo(function LeadershipDashboard({
  tasks,
  members
}: LeadershipDashboardProps) {
  // Memoize computed stats for performance
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const workingTasks = tasks.filter(t => t.status === 'working');
    const pendingTasks = tasks.filter(t => t.status === 'pending');
    const idleTasks = tasks.filter(t => t.status === 'idle');
    
    // Tasks completed today
    const todayCompleted = completedTasks.filter(t => 
      t.completed_at && new Date(t.completed_at) >= today
    ).length;
    
    // Average completion time
    const completedWithDuration = completedTasks.filter(t => t.duration_minutes);
    const avgDuration = completedWithDuration.length > 0
      ? Math.round(completedWithDuration.reduce((sum, t) => sum + (t.duration_minutes || 0), 0) / completedWithDuration.length)
      : 0;
    
    // Team utilization (members with active tasks)
    const activeMembers = new Set(workingTasks.filter(t => t.assigned_to).map(t => t.assigned_to)).size;
    const utilizationRate = members.length > 0 
      ? Math.round((activeMembers / members.length) * 100) 
      : 0;
    
    // Completion rate
    const completionRate = totalTasks > 0 
      ? Math.round((completedTasks.length / totalTasks) * 100) 
      : 0;

    return {
      totalTasks,
      completedCount: completedTasks.length,
      workingCount: workingTasks.length,
      pendingCount: pendingTasks.length,
      idleCount: idleTasks.length,
      todayCompleted,
      avgDuration,
      activeMembers,
      totalMembers: members.length,
      utilizationRate,
      completionRate
    };
  }, [tasks, members]);

  const quickStats: QuickStat[] = useMemo(() => [
    {
      label: 'Active Tasks',
      value: stats.workingCount,
      icon: <Activity className="h-4 w-4" />,
      color: 'text-[hsl(var(--status-working))]'
    },
    {
      label: 'Completed Today',
      value: stats.todayCompleted,
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'text-[hsl(var(--status-completed))]'
    },
    {
      label: 'Pending Review',
      value: stats.pendingCount,
      icon: <AlertTriangle className="h-4 w-4" />,
      color: 'text-[hsl(var(--status-pending))]'
    },
    {
      label: 'Avg. Completion',
      value: `${stats.avgDuration}m`,
      icon: <Clock className="h-4 w-4" />,
      color: 'text-muted-foreground'
    }
  ], [stats]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-display">
          <TrendingUp className="h-5 w-5 text-primary" />
          Leadership Dashboard
          <Badge variant="secondary" className="ml-auto text-xs">
            Live
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickStats.map((stat) => (
            <div 
              key={stat.label}
              className="p-3 rounded-lg bg-muted/50 border border-border/50"
            >
              <div className={`flex items-center gap-1.5 mb-1 ${stat.color}`}>
                {stat.icon}
                <span className="text-xs font-medium">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold font-display">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Team Utilization */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Team Utilization</span>
            </div>
            <span className="text-muted-foreground">
              {stats.activeMembers}/{stats.totalMembers} active
            </span>
          </div>
          <Progress value={stats.utilizationRate} className="h-2" />
        </div>

        {/* Completion Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Task Completion Rate</span>
            </div>
            <span className="text-muted-foreground">
              {stats.completedCount}/{stats.totalTasks} completed
            </span>
          </div>
          <Progress 
            value={stats.completionRate} 
            className="h-2"
          />
        </div>

        {/* Task Status Breakdown */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Badge variant="outline" className="text-xs">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-idle))] mr-1.5" />
            Idle: {stats.idleCount}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-working))] mr-1.5" />
            Working: {stats.workingCount}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-pending))] mr-1.5" />
            Pending: {stats.pendingCount}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <span className="w-2 h-2 rounded-full bg-[hsl(var(--status-completed))] mr-1.5" />
            Completed: {stats.completedCount}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
});

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Zap, 
  Users, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  RefreshCw,
  Bell,
  Shield,
  Activity
} from 'lucide-react';
import { format, addHours, isBefore } from 'date-fns';
import { RefreshButton } from '@/components/ui/RefreshButton';

interface TeamStats {
  totalMembers: number;
  activeTasks: number;
  completedToday: number;
  pendingTasks: number;
  workingNow: number;
  idleTasks: number;
}

interface ActiveUser {
  user_id: string;
  full_name: string;
  status: 'working' | 'pending' | 'idle';
  task_title?: string;
}

interface DeadlineRiskTask {
  id: string;
  title: string;
  assigned_to: string;
  assigned_to_name: string;
  deadline: string;
  status: string;
}

interface RecentActivity {
  id: string;
  action: string;
  user_name: string;
  task_title: string;
  created_at: string;
}

export function LeadershipActionPanel() {
  const { user, isCaptainOrVice } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<TeamStats>({
    totalMembers: 0,
    activeTasks: 0,
    completedToday: 0,
    pendingTasks: 0,
    workingNow: 0,
    idleTasks: 0
  });
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [deadlineRisks, setDeadlineRisks] = useState<DeadlineRiskTask[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch team members count
      const { count: memberCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_test', false);

      // Fetch all tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, completed_at, deadline, assigned_to')
        .eq('is_test', false);

      // Fetch profiles for names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const completedToday = tasks?.filter(t => 
        t.status === 'completed' && 
        t.completed_at && 
        new Date(t.completed_at) >= today
      ).length || 0;

      const pendingTasks = tasks?.filter(t => t.status === 'pending').length || 0;
      const workingNow = tasks?.filter(t => t.status === 'working').length || 0;
      const idleTasks = tasks?.filter(t => t.status === 'idle').length || 0;
      const activeTasks = (tasks?.length || 0) - (tasks?.filter(t => t.status === 'completed').length || 0);

      setStats({
        totalMembers: memberCount || 0,
        activeTasks,
        completedToday,
        pendingTasks,
        workingNow,
        idleTasks
      });

      // Build active users snapshot
      const userStatusMap = new Map<string, ActiveUser>();
      tasks?.forEach(task => {
        if (task.status === 'working' || task.status === 'pending') {
          const existing = userStatusMap.get(task.assigned_to);
          // Working takes priority over pending in display
          if (!existing || task.status === 'working') {
            userStatusMap.set(task.assigned_to, {
              user_id: task.assigned_to,
              full_name: nameMap.get(task.assigned_to) || 'Unknown',
              status: task.status as 'working' | 'pending',
              task_title: task.title
            });
          }
        }
      });
      setActiveUsers(Array.from(userStatusMap.values()));

      // Deadline risk - tasks approaching deadline in next 24 hours
      const in24Hours = addHours(new Date(), 24);
      const riskyTasks = tasks?.filter(t => {
        if (t.status === 'completed' || t.status === 'pending') return false;
        const deadline = new Date(t.deadline);
        return isBefore(deadline, in24Hours) && isBefore(new Date(), deadline);
      }).map(t => ({
        ...t,
        assigned_to_name: nameMap.get(t.assigned_to) || 'Unknown'
      })) || [];
      setDeadlineRisks(riskyTasks);

      // Fetch recent workflow activity
      const { data: activityData } = await supabase
        .from('workflow_log')
        .select('id, action, user_id, task_id, created_at')
        .eq('is_test', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (activityData) {
        // Enrich with names
        const enriched = await Promise.all(activityData.map(async (log) => {
          const { data: task } = await supabase
            .from('tasks')
            .select('title')
            .eq('id', log.task_id)
            .maybeSingle();

          return {
            id: log.id,
            action: log.action,
            user_name: nameMap.get(log.user_id) || 'Unknown',
            task_title: task?.title || 'Unknown Task',
            created_at: log.created_at
          };
        }));

        setRecentActivity(enriched);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();

    // Set up real-time subscription for tasks
    const channel = supabase
      .channel('leadership-stats')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks'
      }, () => {
        fetchStats();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workflow_log'
      }, () => {
        fetchStats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchStats]);

  const handleGlobalRefresh = async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 1000) return;
    lastRefreshRef.current = now;
    
    setIsRefreshing(true);
    await fetchStats();
    setIsRefreshing(false);
    toast({ title: 'Command Center Refreshed', description: 'All data updated' });
  };

  // Push all pending tasks alert
  const handlePushPending = async () => {
    if (!user) return;

    const { data: pendingTasks } = await supabase
      .from('tasks')
      .select('id, assigned_to')
      .eq('status', 'pending')
      .eq('is_test', false);

    if (!pendingTasks || pendingTasks.length === 0) {
      toast({ title: 'No Pending Tasks', description: 'All tasks are on track!' });
      return;
    }

    // Create alerts for all pending tasks
    const alerts = pendingTasks.map(task => ({
      task_id: task.id,
      message: '⚠️ Leadership Reminder: Please complete or submit a reason for your pending task.',
      created_by: user.id
    }));

    const { error } = await supabase
      .from('task_alerts')
      .insert(alerts);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send reminders' });
    } else {
      toast({ 
        title: 'Reminders Sent', 
        description: `Notified ${pendingTasks.length} users with pending tasks` 
      });
    }
  };

  // Push alerts to deadline risks
  const handlePushAlerts = async () => {
    if (!user || deadlineRisks.length === 0) {
      toast({ title: 'No Deadline Risks', description: 'No tasks approaching deadline' });
      return;
    }

    const alerts = deadlineRisks.map(task => ({
      task_id: task.id,
      message: '⏰ Deadline approaching! Please complete your task soon.',
      created_by: user.id
    }));

    const { error } = await supabase
      .from('task_alerts')
      .insert(alerts);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send deadline alerts' });
    } else {
      toast({ 
        title: 'Deadline Alerts Sent', 
        description: `Notified ${deadlineRisks.length} users` 
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6 text-center text-muted-foreground">
          Loading command center...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display">
            <Shield className="w-5 h-5 text-primary" />
            Command Center
            {isCaptainOrVice && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-primary/20 text-primary font-semibold">
                SPECIAL ACCESS
              </span>
            )}
          </div>
          <RefreshButton onClick={handleGlobalRefresh} isRefreshing={isRefreshing} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-lg bg-card border text-center">
            <Users className="w-4 h-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{stats.totalMembers}</p>
            <p className="text-[10px] text-muted-foreground">Team</p>
          </div>
          <div className="p-3 rounded-lg bg-card border text-center">
            <Clock className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-working))]" />
            <p className="text-lg font-bold">{stats.workingNow}</p>
            <p className="text-[10px] text-muted-foreground">Working</p>
          </div>
          <div className="p-3 rounded-lg bg-card border text-center">
            <CheckCircle className="w-4 h-4 mx-auto mb-1 text-[hsl(var(--status-completed))]" />
            <p className="text-lg font-bold">{stats.completedToday}</p>
            <p className="text-[10px] text-muted-foreground">Today</p>
          </div>
        </div>

        {/* Alert Stats */}
        <div className="flex gap-2">
          <div className={`flex-1 p-2 rounded-lg border text-center ${stats.pendingTasks > 0 ? 'bg-[hsl(var(--status-pending))]/10 border-[hsl(var(--status-pending))]/30' : 'bg-muted/50'}`}>
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="w-3 h-3 text-[hsl(var(--status-pending))]" />
              <span className="font-semibold">{stats.pendingTasks}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Pending</p>
          </div>
          <div className="flex-1 p-2 rounded-lg border bg-muted/50 text-center">
            <div className="flex items-center justify-center gap-1">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span className="font-semibold">{stats.idleTasks}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Idle</p>
          </div>
          <div className="flex-1 p-2 rounded-lg border bg-muted/50 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="w-3 h-3 text-primary" />
              <span className="font-semibold">{stats.activeTasks}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Active</p>
          </div>
        </div>

        {/* Active Users Snapshot */}
        {activeUsers.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> Active Users ({activeUsers.length})
            </p>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {activeUsers.map((au) => (
                <div key={au.user_id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                  <span className="font-medium truncate flex-1">{au.full_name}</span>
                  <span className={`${au.status === 'working' ? 'status-badge status-working' : 'status-badge status-pending'}`}>
                    {au.status === 'working' ? 'Working' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deadline Risk List */}
        {deadlineRisks.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Deadline Risks ({deadlineRisks.length})
            </p>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {deadlineRisks.map((task) => (
                <div key={task.id} className="text-xs p-1.5 rounded bg-destructive/10 border border-destructive/20">
                  <p className="font-medium truncate">{task.title}</p>
                  <p className="text-muted-foreground">
                    {task.assigned_to_name} • Due {format(new Date(task.deadline), 'HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions - TL/VC Only */}
        {isCaptainOrVice && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Zap className="w-3 h-3" /> Quick Actions
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-auto py-2 flex-col"
                onClick={handlePushPending}
                disabled={stats.pendingTasks === 0}
              >
                <Bell className="w-4 h-4 mb-1" />
                <span className="text-[10px]">Push Pending</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-auto py-2 flex-col"
                onClick={handlePushAlerts}
                disabled={deadlineRisks.length === 0}
              >
                <AlertTriangle className="w-4 h-4 mb-1" />
                <span className="text-[10px]">Push Alerts</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-auto py-2 flex-col col-span-2"
                onClick={handleGlobalRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mb-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-[10px]">Force Refresh All</span>
              </Button>
            </div>
          </div>
        )}

        {/* Recent Activity Feed */}
        <div className="space-y-2 pt-2 border-t">
          <p className="text-xs font-medium text-muted-foreground">Recent Activity</p>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No recent activity</p>
          ) : (
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-2 p-2 rounded bg-muted/30 text-xs">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{activity.user_name}</span>
                    <span className="text-muted-foreground"> {activity.action}: </span>
                    <span className="truncate">{activity.task_title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(activity.created_at), 'HH:mm')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

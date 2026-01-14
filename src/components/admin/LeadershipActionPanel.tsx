import { useEffect, useState, useCallback } from 'react';
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
import { format } from 'date-fns';

interface TeamStats {
  totalMembers: number;
  activeTasks: number;
  completedToday: number;
  pendingTasks: number;
  workingNow: number;
  idleTasks: number;
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
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
        .select('status, completed_at')
        .eq('is_test', false);

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
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', log.user_id)
            .maybeSingle();

          const { data: task } = await supabase
            .from('tasks')
            .select('title')
            .eq('id', log.task_id)
            .maybeSingle();

          return {
            id: log.id,
            action: log.action,
            user_name: profile?.full_name || 'Unknown',
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStats();
    setIsRefreshing(false);
    toast({ title: 'Dashboard Refreshed' });
  };

  // Push all pending tasks alert
  const handleBroadcastReminder = async () => {
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

  // Reset all idle tasks older than 24 hours
  const handleCleanupIdleTasks = async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: oldIdleTasks } = await supabase
      .from('tasks')
      .select('id, title')
      .eq('status', 'idle')
      .eq('is_test', false)
      .lt('created_at', yesterday.toISOString());

    if (!oldIdleTasks || oldIdleTasks.length === 0) {
      toast({ title: 'No Stale Tasks', description: 'All idle tasks are recent.' });
      return;
    }

    toast({ 
      title: 'Stale Tasks Found', 
      description: `${oldIdleTasks.length} tasks idle for 24+ hours. Review in Today's Task panel.`
    });
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
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
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
                onClick={handleBroadcastReminder}
              >
                <Bell className="w-4 h-4 mb-1" />
                <span className="text-[10px]">Remind Pending</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-auto py-2 flex-col"
                onClick={handleCleanupIdleTasks}
              >
                <RefreshCw className="w-4 h-4 mb-1" />
                <span className="text-[10px]">Check Stale</span>
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

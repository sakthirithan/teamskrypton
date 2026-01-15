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
  Bell,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format, addHours, isBefore } from 'date-fns';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  const [showDetails, setShowDetails] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      const { count: memberCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_test', false);

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, completed_at, deadline, assigned_to')
        .eq('is_test', false);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false);

      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

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

      const userStatusMap = new Map<string, ActiveUser>();
      tasks?.forEach(task => {
        if (task.status === 'working' || task.status === 'pending') {
          const existing = userStatusMap.get(task.assigned_to);
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

      const { data: activityData } = await supabase
        .from('workflow_log')
        .select('id, action, user_id, task_id, created_at')
        .eq('is_test', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (activityData) {
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
    toast({ title: 'Command Center Refreshed' });
  };

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
        description: `Notified ${pendingTasks.length} users` 
      });
    }
  };

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
        <CardContent className="p-4 sm:p-6 text-center text-muted-foreground">
          Loading command center...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-sm sm:text-base">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            <span className="hidden sm:inline">Command Center</span>
            <span className="sm:hidden">Command</span>
            {isCaptainOrVice && (
              <span className="px-1.5 py-0.5 text-[8px] sm:text-[10px] rounded-full bg-primary/20 text-primary font-semibold">
                ACCESS
              </span>
            )}
          </div>
          <RefreshButton onClick={handleGlobalRefresh} isRefreshing={isRefreshing} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-3 sm:px-6 pb-3 sm:pb-6">
        {/* Quick Stats Grid - Responsive */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          <div className="p-2 sm:p-3 rounded-lg bg-card border text-center">
            <Users className="w-3 h-3 sm:w-4 sm:h-4 mx-auto mb-0.5 sm:mb-1 text-primary" />
            <p className="text-base sm:text-lg font-bold">{stats.totalMembers}</p>
            <p className="text-[8px] sm:text-[10px] text-muted-foreground">Team</p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-card border text-center">
            <Clock className="w-3 h-3 sm:w-4 sm:h-4 mx-auto mb-0.5 sm:mb-1 text-[hsl(var(--status-working))]" />
            <p className="text-base sm:text-lg font-bold">{stats.workingNow}</p>
            <p className="text-[8px] sm:text-[10px] text-muted-foreground">Working</p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-card border text-center">
            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mx-auto mb-0.5 sm:mb-1 text-[hsl(var(--status-completed))]" />
            <p className="text-base sm:text-lg font-bold">{stats.completedToday}</p>
            <p className="text-[8px] sm:text-[10px] text-muted-foreground">Today</p>
          </div>
        </div>

        {/* Alert Stats - Compact */}
        <div className="flex gap-1.5 sm:gap-2">
          <div className={`flex-1 p-1.5 sm:p-2 rounded-lg border text-center ${stats.pendingTasks > 0 ? 'bg-[hsl(var(--status-pending))]/10 border-[hsl(var(--status-pending))]/30' : 'bg-muted/50'}`}>
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[hsl(var(--status-pending))]" />
              <span className="font-semibold text-sm sm:text-base">{stats.pendingTasks}</span>
            </div>
            <p className="text-[8px] sm:text-[10px] text-muted-foreground">Pending</p>
          </div>
          <div className="flex-1 p-1.5 sm:p-2 rounded-lg border bg-muted/50 text-center">
            <div className="flex items-center justify-center gap-1">
              <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-muted-foreground" />
              <span className="font-semibold text-sm sm:text-base">{stats.idleTasks}</span>
            </div>
            <p className="text-[8px] sm:text-[10px] text-muted-foreground">Idle</p>
          </div>
          <div className="flex-1 p-1.5 sm:p-2 rounded-lg border bg-muted/50 text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
              <span className="font-semibold text-sm sm:text-base">{stats.activeTasks}</span>
            </div>
            <p className="text-[8px] sm:text-[10px] text-muted-foreground">Active</p>
          </div>
        </div>

        {/* Quick Actions - TL/VC Only - Always visible */}
        {isCaptainOrVice && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-auto py-2.5 sm:py-2 flex-col min-h-[48px]"
              onClick={handlePushPending}
              disabled={stats.pendingTasks === 0}
            >
              <Bell className="w-4 h-4 mb-1" />
              <span className="text-[10px] sm:text-xs">Push Pending</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-auto py-2.5 sm:py-2 flex-col min-h-[48px]"
              onClick={handlePushAlerts}
              disabled={deadlineRisks.length === 0}
            >
              <AlertTriangle className="w-4 h-4 mb-1" />
              <span className="text-[10px] sm:text-xs">Push Alerts</span>
            </Button>
          </div>
        )}

        {/* Collapsible Details - For mobile optimization */}
        <Collapsible open={showDetails} onOpenChange={setShowDetails}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between min-h-[44px]">
              <span className="text-xs text-muted-foreground">
                {showDetails ? 'Hide Details' : 'Show Details'}
              </span>
              {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {/* Active Users Snapshot */}
            {activeUsers.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> Active Users ({activeUsers.length})
                </p>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {activeUsers.map((au) => (
                    <div key={au.user_id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30 min-h-[40px]">
                      <span className="font-medium truncate flex-1 pr-2">{au.full_name}</span>
                      <span className={`shrink-0 ${au.status === 'working' ? 'status-badge status-working' : 'status-badge status-pending'}`}>
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
                    <div key={task.id} className="text-xs p-2 rounded bg-destructive/10 border border-destructive/20">
                      <p className="font-medium truncate">{task.title}</p>
                      <p className="text-muted-foreground">
                        {task.assigned_to_name} • Due {format(new Date(task.deadline), 'HH:mm')}
                      </p>
                    </div>
                  ))}
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
                    <div key={activity.id} className="flex items-start gap-2 p-2 rounded bg-muted/30 text-xs min-h-[40px]">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{activity.user_name}</span>
                        <span className="text-muted-foreground"> {activity.action}: </span>
                        <span className="truncate block">{activity.task_title}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        {format(new Date(activity.created_at), 'HH:mm')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

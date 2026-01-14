import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { KryptonIdCard } from '@/components/team/KryptonIdCard';
import { CheckCircle, BarChart3, ArrowLeft, Clock, AlertTriangle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { KryptonRole, TaskStatus } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { RefreshButton } from '@/components/ui/RefreshButton';

interface MemberData {
  profile: {
    user_id: string;
    full_name: string;
    email: string;
    department: string;
    avatar_url: string | null;
    current_status: TaskStatus | null;
    created_at: string;
  };
  role: KryptonRole | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  status: string;
  accepted_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  assigner_name: string | null;
  assigner_role: string | null;
}

interface Approval {
  id: string;
  approval_type: string;
  reason: string | null;
  status: string;
  created_at: string;
  task_title?: string;
}

const MemberProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, isLoading, isLeadership } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberData | null>(null);
  const [inProgressTasks, setInProgressTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [taskDocs, setTaskDocs] = useState<Map<string, string>>(new Map());
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [stats, setStats] = useState({ accepted: 0, completed: 0, missed: 0, avgTime: 0 });
  const [isFetching, setIsFetching] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const fetchMember = useCallback(async () => {
    if (!userId) return;

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Fetch role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    // Fetch all tasks assigned to member
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', userId)
      .order('created_at', { ascending: false });

    // Fetch task documents
    const { data: docs } = await supabase
      .from('task_documents')
      .select('task_id, github_url')
      .eq('user_id', userId);

    // Fetch pending approvals for this member's tasks
    const { data: approvalsData } = await supabase
      .from('approvals')
      .select('*')
      .eq('target_user_id', userId)
      .eq('approval_type', 'task_reason')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (docs) {
      setTaskDocs(new Map(docs.map(d => [d.task_id, d.github_url])));
    }

    if (profile) {
      setMember({
        profile: {
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email,
          department: profile.department,
          avatar_url: profile.avatar_url,
          current_status: profile.current_status as TaskStatus | null,
          created_at: profile.created_at,
        },
        role: roleData?.role as KryptonRole | null,
      });
    }

    if (tasks) {
      const now = new Date();
      
      // In Progress (working status, deadline not passed)
      const inProgress = tasks.filter(t => t.status === 'working' && new Date(t.deadline) > now);
      setInProgressTasks(inProgress);

      // Pending tasks (deadline exceeded)
      const pending = tasks.filter(t => t.status === 'pending');
      setPendingTasks(pending);

      // Completed
      const completed = tasks.filter(t => t.status === 'completed');
      setCompletedTasks(completed);

      // Stats
      const accepted = tasks.filter(t => t.accepted_at).length;
      const completedCount = completed.length;
      const missed = tasks.filter(t => 
        t.status === 'pending' || 
        (t.status !== 'completed' && new Date(t.deadline) <= now)
      ).length;
      const totalDuration = completed.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
      const avgTime = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;

      setStats({ accepted, completed: completedCount, missed, avgTime });
    }

    if (approvalsData) {
      // Enrich with task titles
      const enriched = await Promise.all(approvalsData.map(async (a) => {
        let task_title = '';
        if (a.target_task_id) {
          const { data } = await supabase
            .from('tasks')
            .select('title')
            .eq('id', a.target_task_id)
            .maybeSingle();
          task_title = data?.title || '';
        }
        return { ...a, task_title };
      }));
      setApprovals(enriched);
    }

    setIsFetching(false);
  }, [userId]);

  const handleManualRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 1000) return;
    lastRefreshRef.current = now;
    
    setIsRefreshing(true);
    await fetchMember();
    setIsRefreshing(false);
    toast({ title: 'Profile data refreshed' });
  }, [fetchMember, toast]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  // Redirect non-leadership to their own MySpace
  useEffect(() => {
    if (!isLoading && user && !isLeadership && userId !== user.id) {
      navigate('/my-space');
    }
  }, [user, isLoading, isLeadership, userId, navigate]);

  useEffect(() => {
    fetchMember();
  }, [fetchMember]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isFetching) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-12 text-center text-muted-foreground">
          Loading member profile...
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-6 py-12 text-center">
          <p className="text-muted-foreground mb-4">Member not found</p>
          <Button onClick={() => navigate('/team')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Team
          </Button>
        </div>
      </div>
    );
  }

  const totalAlerts = pendingTasks.length + approvals.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" onClick={() => navigate('/team')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Team
          </Button>
          <RefreshButton onClick={handleManualRefresh} isRefreshing={isRefreshing} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Krypton ID */}
          <div className="lg:col-span-1">
            <KryptonIdCard profile={member.profile} role={member.role} />

            {/* Productivity Summary */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-display">
                  <BarChart3 className="w-5 h-5" />
                  Productivity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tasks Accepted</span>
                  <span className="font-semibold">{stats.accepted}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-semibold text-[hsl(var(--status-completed))]">{stats.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Missed Deadline</span>
                  <span className="font-semibold text-[hsl(var(--status-pending))]">{stats.missed}</span>
                </div>
                <div className="flex justify-between border-t pt-4">
                  <span className="text-muted-foreground">Avg. Completion</span>
                  <span className="font-semibold">{stats.avgTime}m</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Alerts Panel (Read-only view) */}
            <Card className={totalAlerts > 0 ? 'border-[hsl(var(--status-pending))]/50' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-[hsl(var(--status-pending))]">
                  <AlertTriangle className="w-5 h-5" />
                  Alerts
                  {totalAlerts > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--status-pending))]/20">
                      {totalAlerts}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {totalAlerts === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No alerts - you're on track!</p>
                ) : (
                  <div className="space-y-4">
                    {/* Pending tasks requiring reason */}
                    {pendingTasks.map(task => (
                      <div key={task.id} className="p-4 rounded-lg border border-[hsl(var(--status-pending))]/30 bg-[hsl(var(--status-pending))]/5">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-semibold">{task.title}</h5>
                            <p className="text-sm text-muted-foreground">
                              Deadline: {format(new Date(task.deadline), 'MMM dd, HH:mm')}
                            </p>
                          </div>
                          <span className="status-badge status-pending">Pending</span>
                        </div>
                      </div>
                    ))}
                    
                    {/* Submitted reasons awaiting approval */}
                    {approvals.map(approval => (
                      <div key={approval.id} className="p-4 rounded-lg border bg-muted/30">
                        <div className="flex justify-between items-start">
                          <div>
                            <h5 className="font-semibold">{approval.task_title}</h5>
                            <p className="text-sm text-muted-foreground mb-2">
                              Reason submitted: {format(new Date(approval.created_at), 'MMM dd, HH:mm')}
                            </p>
                            {approval.reason && (
                              <p className="text-sm bg-background p-2 rounded border italic">
                                "{approval.reason}"
                              </p>
                            )}
                          </div>
                          <span className="px-2 py-1 text-xs rounded bg-amber-500/20 text-amber-700">
                            Awaiting Approval
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* In Progress Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <Clock className="w-5 h-5 text-[hsl(var(--status-working))]" />
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                {inProgressTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No tasks in progress</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Assigned By</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inProgressTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>
                            {task.assigner_name ? (
                              <span>
                                {task.assigner_name}
                                {task.assigner_role && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({task.assigner_role})
                                  </span>
                                )}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{task.accepted_at ? format(new Date(task.accepted_at), 'HH:mm') : '-'}</TableCell>
                          <TableCell>{format(new Date(task.deadline), 'MMM dd, HH:mm')}</TableCell>
                          <TableCell><span className="status-badge status-working">Working</span></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Personal Log */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <CheckCircle className="w-5 h-5 text-[hsl(var(--status-completed))]" />
                  Personal Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                {completedTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No completed tasks yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Assigned By</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Docs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedTasks.slice(0, 20).map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>{task.completed_at ? format(new Date(task.completed_at), 'MMM dd') : '-'}</TableCell>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>
                            {task.assigner_name ? (
                              <span>
                                {task.assigner_name}
                                {task.assigner_role && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({task.assigner_role})
                                  </span>
                                )}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{task.accepted_at ? format(new Date(task.accepted_at), 'HH:mm') : '-'}</TableCell>
                          <TableCell>{task.completed_at ? format(new Date(task.completed_at), 'HH:mm') : '-'}</TableCell>
                          <TableCell>{task.duration_minutes ? `${task.duration_minutes}m` : '-'}</TableCell>
                          <TableCell>
                            {taskDocs.has(task.id) ? (
                              <a 
                                href={taskDocs.get(task.id)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </a>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MemberProfile;
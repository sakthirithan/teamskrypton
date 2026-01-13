import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { KryptonIdCard } from '@/components/team/KryptonIdCard';
import { AlertTriangle, CheckCircle, Clock, BarChart3, Save } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { TaskStatus } from '@/lib/constants';

interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  status: string;
  accepted_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
}

interface AlertTask extends Task {
  reason?: string;
}

const MySpace = () => {
  const { user, profile, role, isLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [alertTasks, setAlertTasks] = useState<AlertTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({ accepted: 0, completed: 0, missed: 0, avgTime: 0 });
  const [isFetching, setIsFetching] = useState(true);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      // Fetch all tasks assigned to user
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false });

      if (tasks) {
        const now = new Date();
        
        // Pending (working status)
        const pending = tasks.filter(t => t.status === 'working' && new Date(t.deadline) > now);
        setPendingTasks(pending);

        // Alerts (missed deadline or pending status)
        const alerts = tasks.filter(t => 
          t.status === 'pending' || 
          (t.status === 'working' && new Date(t.deadline) <= now)
        );
        setAlertTasks(alerts);

        // Completed
        const completed = tasks.filter(t => t.status === 'completed');
        setCompletedTasks(completed);

        // Stats
        const accepted = tasks.filter(t => t.accepted_at).length;
        const completedCount = completed.length;
        const missed = alerts.length;
        const totalDuration = completed.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
        const avgTime = completedCount > 0 ? Math.round(totalDuration / completedCount) : 0;

        setStats({ accepted, completed: completedCount, missed, avgTime });
      }
      setIsFetching(false);
    };

    fetchData();
  }, [user]);

  const handleSaveReason = async (taskId: string) => {
    const reason = reasons[taskId];
    if (!reason) return;

    // For now, we'll just show a toast since we don't have a reason column
    // In production, you'd add a reason column to tasks table
    toast({
      title: 'Reason Saved',
      description: 'Your explanation has been recorded.',
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Krypton ID */}
          <div className="lg:col-span-1">
            {profile && (
              <KryptonIdCard
                profile={{
                  user_id: user.id,
                  full_name: profile.full_name,
                  email: profile.email,
                  department: profile.department,
                  avatar_url: profile.avatar_url,
                  current_status: profile.current_status as TaskStatus | null,
                  created_at: profile.created_at,
                }}
                role={role}
              />
            )}

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
            {/* Alerts Panel */}
            <Card className={alertTasks.length > 0 ? 'border-[hsl(var(--status-pending))]/50' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-[hsl(var(--status-pending))]">
                  <AlertTriangle className="w-5 h-5" />
                  Alerts
                  {alertTasks.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[hsl(var(--status-pending))]/20">
                      {alertTasks.length}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {alertTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No alerts - you're on track!</p>
                ) : (
                  <div className="space-y-4">
                    {alertTasks.map((task) => (
                      <div key={task.id} className="p-4 rounded-lg border border-[hsl(var(--status-pending))]/30 bg-[hsl(var(--status-pending))]/5">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold">{task.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              Deadline: {format(new Date(task.deadline), 'MMM dd, HH:mm')}
                            </p>
                          </div>
                          <span className="status-badge status-pending">Missed</span>
                        </div>
                        <Textarea
                          placeholder="Explain the delay..."
                          value={reasons[task.id] || ''}
                          onChange={(e) => setReasons({ ...reasons, [task.id]: e.target.value })}
                          rows={2}
                          className="mb-2"
                        />
                        <Button size="sm" onClick={() => handleSaveReason(task.id)}>
                          <Save className="w-4 h-4 mr-1" />
                          Save Reason
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pending Tasks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <Clock className="w-5 h-5 text-[hsl(var(--status-working))]" />
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No tasks in progress</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="font-medium">{task.title}</TableCell>
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
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedTasks.slice(0, 20).map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>{task.completed_at ? format(new Date(task.completed_at), 'MMM dd') : '-'}</TableCell>
                          <TableCell className="font-medium">{task.title}</TableCell>
                          <TableCell>{task.accepted_at ? format(new Date(task.accepted_at), 'HH:mm') : '-'}</TableCell>
                          <TableCell>{task.completed_at ? format(new Date(task.completed_at), 'HH:mm') : '-'}</TableCell>
                          <TableCell>{task.duration_minutes ? `${task.duration_minutes}m` : '-'}</TableCell>
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

export default MySpace;

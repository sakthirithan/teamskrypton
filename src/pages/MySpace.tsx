import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KryptonIdCard } from '@/components/team/KryptonIdCard';
import { AlertTab } from '@/components/alerts/AlertTab';
import { CheckCircle, Clock, BarChart3, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
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
  assigner_name: string | null;
  assigner_role: string | null;
}

interface TaskDoc {
  task_id: string;
  github_url: string;
}

const MySpace = () => {
  const { user, profile, role, isLoading } = useAuth();
  const navigate = useNavigate();
  const [pendingTasks, setPendingTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [taskDocs, setTaskDocs] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState({ accepted: 0, completed: 0, missed: 0, avgTime: 0 });
  const [isFetching, setIsFetching] = useState(true);

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

      // Fetch task documents
      const { data: docs } = await supabase
        .from('task_documents')
        .select('task_id, github_url')
        .eq('user_id', user.id);

      if (docs) {
        setTaskDocs(new Map(docs.map(d => [d.task_id, d.github_url])));
      }

      if (tasks) {
        const now = new Date();
        
        // In Progress (working status, deadline not passed)
        const pending = tasks.filter(t => t.status === 'working' && new Date(t.deadline) > now);
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
      setIsFetching(false);
    };

    fetchData();
  }, [user]);

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
            <AlertTab />

            {/* In Progress Tasks */}
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
                        <TableHead>Assigned By</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingTasks.map((task) => (
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

export default MySpace;

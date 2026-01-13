import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { KryptonIdCard } from '@/components/team/KryptonIdCard';
import { CheckCircle, BarChart3, ArrowLeft, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { KryptonRole, TaskStatus } from '@/lib/constants';

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

interface CompletedTask {
  id: string;
  title: string;
  completed_at: string | null;
  duration_minutes: number | null;
}

const MemberPublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, isLoading, isLeadership } = useAuth();
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberData | null>(null);
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [taskDocs, setTaskDocs] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState({ completed: 0, totalTasks: 0 });
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  // Redirect leadership to full profile view
  useEffect(() => {
    if (!isLoading && user && isLeadership && userId !== user.id) {
      navigate(`/member/${userId}`);
    }
  }, [user, isLoading, isLeadership, userId, navigate]);

  // Redirect to my-space if viewing own profile
  useEffect(() => {
    if (!isLoading && user && userId === user.id) {
      navigate('/my-space');
    }
  }, [user, isLoading, userId, navigate]);

  useEffect(() => {
    const fetchMember = async () => {
      if (!userId) return;

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .eq('is_test', false)
        .single();

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      // Fetch ONLY completed tasks (limited visibility)
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, completed_at, duration_minutes, status')
        .eq('assigned_to', userId)
        .eq('status', 'completed')
        .eq('is_test', false)
        .order('completed_at', { ascending: false })
        .limit(20);

      // Fetch total task count
      const { count: totalCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', userId)
        .eq('is_test', false);

      // Fetch task documents
      const { data: docs } = await supabase
        .from('task_documents')
        .select('task_id, github_url')
        .eq('user_id', userId);

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
        setCompletedTasks(tasks);
        setStats({ 
          completed: tasks.length, 
          totalTasks: totalCount || 0 
        });
      }

      setIsFetching(false);
    };

    fetchMember();
  }, [userId]);

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-6">
        <Button variant="ghost" onClick={() => navigate('/team')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Team
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Krypton ID */}
          <div className="lg:col-span-1">
            <KryptonIdCard profile={member.profile} role={member.role} />

            {/* Limited Stats - Only completed count and total */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-display">
                  <BarChart3 className="w-5 h-5" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Tasks</span>
                  <span className="font-semibold">{stats.totalTasks}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-semibold text-[hsl(var(--status-completed))]">{stats.completed}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content - Only Completed Tasks */}
          <div className="lg:col-span-3 space-y-6">
            {/* Personal Log - Completed Tasks Only */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <CheckCircle className="w-5 h-5 text-[hsl(var(--status-completed))]" />
                  Completed Tasks
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
                        <TableHead>Duration</TableHead>
                        <TableHead>Docs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>{task.completed_at ? format(new Date(task.completed_at), 'MMM dd, yyyy') : '-'}</TableCell>
                          <TableCell className="font-medium">{task.title}</TableCell>
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

            {/* Info note about limited visibility */}
            <div className="text-center text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg">
              <p>This is a public profile view. Only completed tasks and basic information are visible.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MemberPublicProfile;

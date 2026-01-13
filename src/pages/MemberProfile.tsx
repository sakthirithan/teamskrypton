import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { KryptonIdCard } from '@/components/team/KryptonIdCard';
import { CheckCircle, BarChart3, ArrowLeft } from 'lucide-react';
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

interface Task {
  id: string;
  title: string;
  accepted_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
}

const MemberProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [member, setMember] = useState<MemberData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({ completed: 0, avgTime: 0 });
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    const fetchMember = async () => {
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

      // Fetch completed tasks
      const { data: taskData } = await supabase
        .from('tasks')
        .select('id, title, accepted_at, completed_at, duration_minutes')
        .eq('assigned_to', userId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(20);

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

      if (taskData) {
        setTasks(taskData);
        const totalDuration = taskData.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
        const avgTime = taskData.length > 0 ? Math.round(totalDuration / taskData.length) : 0;
        setStats({ completed: taskData.length, avgTime });
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar - Krypton ID */}
          <div className="lg:col-span-1">
            <KryptonIdCard profile={member.profile} role={member.role} />

            {/* Stats */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-display">
                  <BarChart3 className="w-5 h-5" />
                  Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tasks Completed</span>
                  <span className="font-semibold">{stats.completed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg. Time</span>
                  <span className="font-semibold">{stats.avgTime}m</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main - Completed Tasks Log */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display">
                  <CheckCircle className="w-5 h-5 text-[hsl(var(--status-completed))]" />
                  Completed Tasks
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No completed tasks yet</p>
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
                      {tasks.map((task) => (
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

export default MemberProfile;

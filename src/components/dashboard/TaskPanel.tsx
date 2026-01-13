import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, Play, AlertCircle, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  status: string;
  assigned_by: string;
  accepted_at: string | null;
  assigner_name?: string;
  assigner_role?: string;
}

export function TaskPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', user.id)
      .in('status', ['idle', 'working'])
      .order('deadline', { ascending: true });

    if (!error && data) {
      setTasks(data);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('tasks-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_to=eq.${user.id}`,
        },
        (payload) => {
          console.log('Task change received:', payload);
          fetchTasks();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchTasks]);

  const handleAccept = async (taskId: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'working', accepted_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to accept task' });
    } else {
      toast({ title: 'Task Accepted', description: 'Timer started!' });
      fetchTasks();
    }
  };

  const handleComplete = async (taskId: string, acceptedAt: string | null) => {
    const completedAt = new Date().toISOString();
    const duration = acceptedAt 
      ? Math.round((new Date(completedAt).getTime() - new Date(acceptedAt).getTime()) / 60000)
      : 0;

    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: completedAt, duration_minutes: duration })
      .eq('id', taskId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to complete task' });
    } else {
      toast({ title: 'Task Completed!', description: `Duration: ${duration} minutes` });
      fetchTasks();
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'working': return 'status-badge status-working';
      case 'completed': return 'status-badge status-completed';
      case 'pending': return 'status-badge status-pending';
      default: return 'status-badge status-idle';
    }
  };

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading tasks...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display">
          <Clock className="w-5 h-5" />
          Today's Tasks
          {isConnected && (
            <span title="Real-time connected" className="ml-auto">
              <Wifi className="w-4 h-4 text-green-500" />
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No tasks assigned to you</p>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task.id} className="p-4 rounded-lg border bg-card hover:shadow-card transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold">{task.title}</h4>
                    {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className={getStatusClass(task.status)}>{task.status}</span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <AlertCircle className="w-3 h-3" />
                        {formatDistanceToNow(new Date(task.deadline), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {task.status === 'idle' && (
                      <Button size="sm" onClick={() => handleAccept(task.id)}>
                        <Play className="w-4 h-4 mr-1" /> Accept
                      </Button>
                    )}
                    {task.status === 'working' && (
                      <Button size="sm" variant="secondary" onClick={() => handleComplete(task.id, task.accepted_at)}>
                        <CheckCircle className="w-4 h-4 mr-1" /> Complete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

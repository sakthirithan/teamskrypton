import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTestSession } from '@/contexts/TestSessionContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, Play, AlertCircle, Wifi, Edit2, Trash2, Calendar, Users, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';

interface Task {
  id: string;
  title: string;
  description: string | null;
  deadline: string;
  status: string;
  assigned_by: string;
  assigned_to: string;
  accepted_at: string | null;
  created_at: string;
  assigner_name: string | null;
  assigner_role: string | null;
}

interface Member {
  user_id: string;
  full_name: string;
  role: KryptonRole | null;
}

type StatusFilter = 'all' | 'working' | 'pending';

export function TaskPanel() {
  const { user, isCaptainOrVice, isLeadership } = useAuth();
  const { isTestMode } = useTestSession();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ 
    title: '', 
    description: '', 
    deadline: '',
    assignTo: ''
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Fetch members for reassignment
  useEffect(() => {
    const fetchMembers = async () => {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      
      if (profiles && roles) {
        const roleMap = new Map(roles.map(r => [r.user_id, r.role as KryptonRole]));
        const membersWithRoles = profiles.map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          role: roleMap.get(p.user_id) || null
        }));
        setMembers(membersWithRoles);
      }
    };
    fetchMembers();
  }, []);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', user.id)
      .in('status', ['idle', 'working', 'pending'])
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

  const handleEditTask = async () => {
    if (!editingTask) return;

    const updates: any = { 
      title: editForm.title, 
      description: editForm.description || null 
    };

    // Only TL/VC can change deadline and assignee
    if (isCaptainOrVice) {
      if (editForm.deadline) {
        updates.deadline = new Date(editForm.deadline).toISOString();
      }
      if (editForm.assignTo && editForm.assignTo !== editingTask.assigned_to) {
        updates.assigned_to = editForm.assignTo;
      }
    }

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', editingTask.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update task' });
    } else {
      toast({ title: 'Task Updated' });
      setEditingTask(null);
      fetchTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    // Only TL/VC can delete tasks - no log entry created
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete task' });
    } else {
      toast({ title: 'Task Deleted', description: 'The task has been removed.' });
      setDeleteConfirmTask(null);
      fetchTasks();
    }
  };

  // TL/VC can delete completed tasks - triggers reason flow
  const handleDeleteCompletedTask = async (task: Task) => {
    if (!user) return;
    
    try {
      // Move task back to user's Today's Task as "working" status
      await supabase
        .from('tasks')
        .update({ 
          status: 'working',
          completed_at: null,
          duration_minutes: null
        })
        .eq('id', task.id);

      // Create approval request for the user to provide reason
      await supabase
        .from('approvals')
        .insert({
          approval_type: 'task_deletion_reason',
          target_task_id: task.id,
          target_user_id: task.assigned_to,
          initiated_by: user.id,
          status: 'pending',
          is_test: isTestMode
        });

      toast({ 
        title: 'Completed Task Removed', 
        description: 'Task restored to user\'s panel. They will be asked for a reason.' 
      });
      setDeleteConfirmTask(null);
      fetchTasks();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
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

  const getMemberName = (userId: string) => {
    return members.find(m => m.user_id === userId)?.full_name || 'Unknown';
  };

  // Filter tasks by status
  const filteredTasks = tasks.filter(task => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'working') return task.status === 'working' || task.status === 'idle';
    if (statusFilter === 'pending') return task.status === 'pending';
    return true;
  });

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading tasks...</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between font-display">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Today's Tasks
            {isConnected && (
              <span title="Real-time connected">
                <Wifi className="w-4 h-4 text-green-500" />
              </span>
            )}
          </div>
          
          {/* Status Filter */}
          <ToggleGroup 
            type="single" 
            value={statusFilter} 
            onValueChange={(value) => value && setStatusFilter(value as StatusFilter)}
            className="border rounded-md"
          >
            <ToggleGroupItem value="all" size="sm" className="text-xs px-3">
              All
            </ToggleGroupItem>
            <ToggleGroupItem value="working" size="sm" className="text-xs px-3">
              Active
            </ToggleGroupItem>
            <ToggleGroupItem value="pending" size="sm" className="text-xs px-3">
              Pending
            </ToggleGroupItem>
          </ToggleGroup>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filteredTasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {statusFilter !== 'all' ? 'No tasks match the current filter' : 'No tasks assigned to you'}
          </p>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div key={task.id} className="p-4 rounded-lg border bg-card hover:shadow-card transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-semibold">{task.title}</h4>
                    {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                    
                    {/* Assigner Info */}
                    {task.assigner_name && (
                      <p className="text-xs text-muted-foreground mt-2">
                        <span className="font-medium">Assigned By:</span> {task.assigner_name}
                        {task.assigner_role && ` (${task.assigner_role})`}
                      </p>
                    )}

                    {/* Assigned Date */}
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Assigned:</span> {format(new Date(task.created_at), 'MMM dd, yyyy HH:mm')}
                    </p>

                    {/* Deadline */}
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Deadline:</span> {format(new Date(task.deadline), 'MMM dd, yyyy HH:mm')}
                    </p>
                    
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className={getStatusClass(task.status)}>{task.status}</span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <AlertCircle className="w-3 h-3" />
                        {formatDistanceToNow(new Date(task.deadline), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {/* TL & VC can edit task details including deadline and assignees */}
                    {isCaptainOrVice && (
                      <>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => {
                                setEditingTask(task);
                                setEditForm({ 
                                  title: task.title, 
                                  description: task.description || '',
                                  deadline: task.deadline ? format(new Date(task.deadline), "yyyy-MM-dd'T'HH:mm") : '',
                                  assignTo: task.assigned_to
                                });
                              }}
                              title="Edit Task"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Task (TL/VC Override)</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                              <div>
                                <Label>Title</Label>
                                <Input 
                                  value={editForm.title}
                                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label>Description</Label>
                                <Textarea 
                                  value={editForm.description}
                                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                  rows={3}
                                />
                              </div>
                              <div>
                                <Label className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" /> Deadline
                                </Label>
                                <Input 
                                  type="datetime-local"
                                  value={editForm.deadline}
                                  onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  Note: Start/End times are system-controlled
                                </p>
                              </div>
                              <div>
                                <Label className="flex items-center gap-1">
                                  <Users className="w-4 h-4" /> Assigned To
                                </Label>
                                <select
                                  value={editForm.assignTo}
                                  onChange={(e) => setEditForm({ ...editForm, assignTo: e.target.value })}
                                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                >
                                  {members.map((m) => (
                                    <option key={m.user_id} value={m.user_id}>
                                      {m.full_name} {m.role && `(${ROLE_LABELS[m.role]})`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <Button onClick={handleEditTask} className="w-full">
                                Save Changes
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Delete button for TL/VC */}
                        <Dialog open={deleteConfirmTask?.id === task.id} onOpenChange={(open) => !open && setDeleteConfirmTask(null)}>
                          <DialogTrigger asChild>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteConfirmTask(task)}
                              title="Delete Task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete Task</DialogTitle>
                              <DialogDescription>
                                {task.status === 'completed' 
                                  ? 'This will restore the task to the user\'s panel and request a reason.' 
                                  : 'This action cannot be undone.'}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                              <div className="p-3 rounded bg-muted">
                                <p className="font-medium">{task.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Assigned to: {getMemberName(task.assigned_to)}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  className="flex-1"
                                  onClick={() => setDeleteConfirmTask(null)}
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  className="flex-1"
                                  onClick={() => task.status === 'completed' 
                                    ? handleDeleteCompletedTask(task) 
                                    : handleDeleteTask(task.id)}
                                >
                                  {task.status === 'completed' ? (
                                    <>
                                      <RotateCcw className="w-4 h-4 mr-1" />
                                      Remove & Restore
                                    </>
                                  ) : 'Delete'}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                    
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

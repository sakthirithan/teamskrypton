import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CheckCircle, Play, AlertCircle, Wifi, Edit2, Trash2, Calendar, Users, RotateCcw, Bell, MessageSquare, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';

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

interface TaskAlert {
  id: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface Member {
  user_id: string;
  full_name: string;
  role: KryptonRole | null;
}

type StatusFilter = 'all' | 'idle' | 'working' | 'pending';

export function TaskPanel() {
  const { user, isCaptainOrVice, isLeadership } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskAlerts, setTaskAlerts] = useState<Map<string, TaskAlert[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ 
    title: '', 
    description: '', 
    deadline: '',
    assignTo: ''
  });
  const [alertForm, setAlertForm] = useState({ taskId: '', message: '' });
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [pushToPendingTask, setPushToPendingTask] = useState<Task | null>(null);
  const [pendingReason, setPendingReason] = useState('');

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
    
    let query = supabase
      .from('tasks')
      .select('*')
      .in('status', ['idle', 'working', 'pending'])
      .order('deadline', { ascending: true });

    // Leadership sees ALL tasks; normal users see only their own
    if (!isLeadership) {
      query = query.eq('assigned_to', user.id);
    }

    const { data, error } = await query;

    if (!error && data) {
      setTasks(data);
      
      // Fetch alerts for these tasks
      if (data.length > 0) {
        const taskIds = data.map(t => t.id);
        const { data: alertsData } = await supabase
          .from('task_alerts')
          .select('*')
          .in('task_id', taskIds)
          .order('created_at', { ascending: false });
        
        if (alertsData) {
          const alertsMap = new Map<string, TaskAlert[]>();
          alertsData.forEach(alert => {
            const existing = alertsMap.get(alert.task_id) || [];
            existing.push(alert);
            alertsMap.set(alert.task_id, existing);
          });
          setTaskAlerts(alertsMap);
        }
      }
    }
    setIsLoading(false);
  }, [user, isLeadership]);

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
        },
        (payload) => {
          console.log('Task change received:', payload);
          fetchTasks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_alerts',
        },
        () => {
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
    const task = tasks.find(t => t.id === taskId);
    // Only assigned user can accept
    if (task && task.assigned_to !== user?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Only the assigned user can accept this task' });
      return;
    }

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
    const task = tasks.find(t => t.id === taskId);
    // Only assigned user can complete
    if (task && task.assigned_to !== user?.id) {
      toast({ variant: 'destructive', title: 'Error', description: 'Only the assigned user can complete this task' });
      return;
    }

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

    // Leadership can change deadline and assignee
    if (isLeadership) {
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

  // Send alert message to task - Leadership only
  const handleSendAlert = async () => {
    if (!alertForm.taskId || !alertForm.message || !user) return;

    const { error } = await supabase
      .from('task_alerts')
      .insert({
        task_id: alertForm.taskId,
        message: alertForm.message,
        created_by: user.id
      });

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send alert' });
    } else {
      toast({ title: 'Alert Sent', description: 'The assigned user has been notified' });
      setAlertForm({ taskId: '', message: '' });
      setShowAlertDialog(false);
      fetchTasks();
    }
  };

  // Push task to Pending - TL/VC only
  const handlePushToPending = async () => {
    if (!pushToPendingTask || !user || !pendingReason) return;

    try {
      // Update task status to pending
      await supabase
        .from('tasks')
        .update({ status: 'pending' })
        .eq('id', pushToPendingTask.id);

      // Create alert with reason
      await supabase
        .from('task_alerts')
        .insert({
          task_id: pushToPendingTask.id,
          message: `Task pushed to Pending by leadership: ${pendingReason}`,
          created_by: user.id
        });

      toast({ 
        title: 'Task Pushed to Pending', 
        description: 'User has been notified.' 
      });
      setPushToPendingTask(null);
      setPendingReason('');
      fetchTasks();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Delete task - TL/VC only (non-completed tasks are deleted)
  const handleDeleteTask = async (taskId: string) => {
    // First delete related records
    await supabase.from('task_documents').delete().eq('task_id', taskId);
    await supabase.from('task_alerts').delete().eq('task_id', taskId);
    
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

  // Reset task to Idle - TL/VC can reset any task (from log or panel)
  const handleResetTask = async (task: Task) => {
    if (!user) return;
    
    try {
      // Reset task to idle status - preserves timestamps for audit
      await supabase
        .from('tasks')
        .update({ 
          status: 'idle',
          accepted_at: null,
          completed_at: null,
          duration_minutes: null
        })
        .eq('id', task.id);

      // Create alert to notify the assigned user
      await supabase
        .from('task_alerts')
        .insert({
          task_id: task.id,
          message: 'Your task was reset by leadership. Please accept and complete it again.',
          created_by: user.id
        });

      toast({ 
        title: 'Task Reset', 
        description: 'Task restored to Idle. User has been notified.' 
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
    return task.status === statusFilter;
  });

  // Get users currently working (for leadership working panel)
  const workingTasks = tasks.filter(t => t.status === 'working');

  // Check if current user is the assigned user for a task
  const isAssignedUser = (task: Task) => task.assigned_to === user?.id;

  if (isLoading) {
    return <Card><CardContent className="p-6 text-center text-muted-foreground">Loading tasks...</CardContent></Card>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between font-display">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Today's Tasks
              {isLeadership && <Badge variant="secondary" className="ml-2 text-xs">All Tasks</Badge>}
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
              <ToggleGroupItem value="idle" size="sm" className="text-xs px-3">
                Idle
              </ToggleGroupItem>
              <ToggleGroupItem value="working" size="sm" className="text-xs px-3">
                Working
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
              {statusFilter !== 'all' ? 'No tasks match the current filter' : (isLeadership ? 'No active tasks' : 'No tasks assigned to you')}
            </p>
          ) : (
            <div className="space-y-4">
              {filteredTasks.map((task) => {
                const alerts = taskAlerts.get(task.id) || [];
                const unreadAlerts = alerts.filter(a => !a.is_read);
                
                return (
                  <div key={task.id} className="p-4 rounded-lg border bg-card hover:shadow-card transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{task.title}</h4>
                          {unreadAlerts.length > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              <Bell className="w-3 h-3 mr-1" />
                              {unreadAlerts.length}
                            </Badge>
                          )}
                        </div>
                        {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                        
                        {/* Show alerts if any */}
                        {unreadAlerts.length > 0 && (
                          <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                            <p className="text-xs font-medium text-destructive mb-1">Leadership Alert:</p>
                            <p className="text-sm">{unreadAlerts[0].message}</p>
                          </div>
                        )}
                        
                        {/* Assigned To Info - visible for leadership */}
                        {isLeadership && (
                          <p className="text-xs text-muted-foreground mt-2">
                            <span className="font-medium">Assigned To:</span> {getMemberName(task.assigned_to)}
                          </p>
                        )}
                        
                        {/* Assigner Info */}
                        {task.assigner_name && (
                          <p className="text-xs text-muted-foreground">
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

                        {/* Start time for working tasks */}
                        {task.status === 'working' && task.accepted_at && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">Started:</span> {format(new Date(task.accepted_at), 'HH:mm')}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-3 mt-2 text-sm">
                          <span className={getStatusClass(task.status)}>{task.status}</span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <AlertCircle className="w-3 h-3" />
                            {formatDistanceToNow(new Date(task.deadline), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {/* Leadership can edit tasks */}
                        {isLeadership && (
                          <>
                            {/* Edit Button */}
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
                                  <DialogTitle>Edit Task</DialogTitle>
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

                            {/* Alert Button */}
                            <Dialog open={showAlertDialog && alertForm.taskId === task.id} onOpenChange={(open) => {
                              setShowAlertDialog(open);
                              if (open) setAlertForm({ taskId: task.id, message: '' });
                            }}>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => setAlertForm({ taskId: task.id, message: '' })}
                                  title="Send Alert"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Send Alert to Assigned User</DialogTitle>
                                  <DialogDescription>
                                    This alert will be visible to {getMemberName(task.assigned_to)} on this task.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 pt-4">
                                  <div>
                                    <Label>Alert Message</Label>
                                    <Textarea 
                                      value={alertForm.message}
                                      onChange={(e) => setAlertForm({ ...alertForm, message: e.target.value })}
                                      placeholder="Enter your alert message..."
                                      rows={3}
                                    />
                                  </div>
                                  <Button onClick={handleSendAlert} className="w-full" disabled={!alertForm.message}>
                                    Send Alert
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>

                            {/* Push to Pending - TL/VC only */}
                            {isCaptainOrVice && task.status !== 'pending' && (
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                onClick={() => setPushToPendingTask(task)}
                                title="Push to Pending"
                              >
                                <AlertTriangle className="w-4 h-4" />
                              </Button>
                            )}

                            {/* Delete/Reset Button - TL/VC ONLY */}
                            {isCaptainOrVice && (
                              <Dialog open={deleteConfirmTask?.id === task.id} onOpenChange={(open) => !open && setDeleteConfirmTask(null)}>
                                <DialogTrigger asChild>
                                  <Button 
                                    size="sm" 
                                    variant="ghost"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeleteConfirmTask(task)}
                                    title="Delete/Reset Task"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Task Action</DialogTitle>
                                    <DialogDescription>
                                      Choose an action for this task.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <div className="p-3 rounded bg-muted">
                                      <p className="font-medium">{task.title}</p>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Assigned to: {getMemberName(task.assigned_to)}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Status: {task.status}
                                      </p>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                      <Button 
                                        variant="outline"
                                        onClick={() => handleResetTask(task)}
                                        className="w-full"
                                      >
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                        Reset to Idle (User Notified)
                                      </Button>
                                      <Button 
                                        variant="destructive" 
                                        onClick={() => handleDeleteTask(task.id)}
                                        className="w-full"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Permanently
                                      </Button>
                                      <Button 
                                        variant="ghost"
                                        onClick={() => setDeleteConfirmTask(null)}
                                        className="w-full"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            )}
                          </>
                        )}
                        
                        {/* Accept button - only for assigned user when idle */}
                        {task.status === 'idle' && isAssignedUser(task) && (
                          <Button size="sm" onClick={() => handleAccept(task.id)}>
                            <Play className="w-4 h-4 mr-1" /> Accept
                          </Button>
                        )}
                        
                        {/* Complete button - only for assigned user when working */}
                        {task.status === 'working' && isAssignedUser(task) && (
                          <Button size="sm" variant="secondary" onClick={() => handleComplete(task.id, task.accepted_at)}>
                            <CheckCircle className="w-4 h-4 mr-1" /> Complete
                          </Button>
                        )}

                        {/* Pending status - no action buttons, only displays for user */}
                        {task.status === 'pending' && isAssignedUser(task) && (
                          <Badge variant="outline" className="text-orange-600">
                            Submit reason in Alerts
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Working Panel - Leadership only */}
      {isLeadership && workingTasks.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display text-[hsl(var(--status-working))]">
              <Clock className="w-5 h-5" />
              Currently Working
              <Badge variant="secondary" className="ml-2">{workingTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {workingTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border bg-[hsl(var(--status-working))]/5">
                  <div>
                    <p className="font-medium">{getMemberName(task.assigned_to)}</p>
                    <p className="text-sm text-muted-foreground">{task.title}</p>
                    {task.accepted_at && (
                      <p className="text-xs text-muted-foreground">
                        Started: {format(new Date(task.accepted_at), 'HH:mm')}
                      </p>
                    )}
                  </div>
                  {isCaptainOrVice && (
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-amber-600"
                        onClick={() => {
                          setAlertForm({ taskId: task.id, message: '' });
                          setShowAlertDialog(true);
                        }}
                        title="Send Alert"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="text-orange-600"
                        onClick={() => setPushToPendingTask(task)}
                        title="Push to Pending"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Push to Pending Dialog */}
      <Dialog open={!!pushToPendingTask} onOpenChange={(open) => !open && setPushToPendingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              Push Task to Pending
            </DialogTitle>
            <DialogDescription>
              This will mark the task as Pending and notify the assigned user.
            </DialogDescription>
          </DialogHeader>
          {pushToPendingTask && (
            <div className="space-y-4 pt-4">
              <div className="p-3 rounded bg-muted">
                <p className="font-medium">{pushToPendingTask.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Assigned to: {getMemberName(pushToPendingTask.assigned_to)}
                </p>
              </div>
              <div>
                <Label>Reason (Required)</Label>
                <Textarea 
                  value={pendingReason}
                  onChange={(e) => setPendingReason(e.target.value)}
                  placeholder="Explain why this task is being marked as pending..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handlePushToPending}
                  disabled={!pendingReason}
                  className="flex-1"
                >
                  Push to Pending
                </Button>
                <Button 
                  variant="ghost"
                  onClick={() => {
                    setPushToPendingTask(null);
                    setPendingReason('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

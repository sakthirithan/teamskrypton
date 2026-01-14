import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KryptonIdCard } from '@/components/team/KryptonIdCard';
import { AlertTab } from '@/components/alerts/AlertTab';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle, Clock, BarChart3, ExternalLink, Trash2, RotateCcw, Download, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { TaskStatus } from '@/lib/constants';
import { useToast } from '@/hooks/use-toast';
import { RefreshButton } from '@/components/ui/RefreshButton';
import { validateExportDateRange, getTodayString } from '@/lib/exportValidation';
import * as XLSX from 'xlsx';

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
  assigned_to: string;
}

interface TaskDoc {
  task_id: string;
  github_url: string;
}

const MySpace = () => {
  const { user, profile, role, isLoading, isCaptainOrVice } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [inProgressTasks, setInProgressTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [taskDocs, setTaskDocs] = useState<Map<string, string>>(new Map());
  const [stats, setStats] = useState({ accepted: 0, completed: 0, missed: 0, avgTime: 0 });
  const [isFetching, setIsFetching] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<Task | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [manualStatusOverride, setManualStatusOverride] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const handleManualRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 1000) return;
    lastRefreshRef.current = now;
    
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    toast({ title: 'Data refreshed' });
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

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
      
      // In Progress (working status)
      const inProgress = tasks.filter(t => t.status === 'working');
      setInProgressTasks(inProgress);

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

  useEffect(() => {
    fetchData();
  }, [user]);

  // Complete task from In Progress
  const handleComplete = async (task: Task) => {
    const completedAt = new Date().toISOString();
    const duration = task.accepted_at 
      ? Math.round((new Date(completedAt).getTime() - new Date(task.accepted_at).getTime()) / 60000)
      : 0;

    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', completed_at: completedAt, duration_minutes: duration })
      .eq('id', task.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to complete task' });
    } else {
      toast({ title: 'Task Completed!', description: `Duration: ${duration} minutes` });
      fetchData();
    }
  };

  // Reset task to Idle - TL/VC only
  const handleResetTask = async (task: Task) => {
    if (!user) return;
    
    try {
      await supabase
        .from('tasks')
        .update({ 
          status: 'idle',
          accepted_at: null,
          completed_at: null,
          duration_minutes: null
        })
        .eq('id', task.id);

      await supabase
        .from('task_alerts')
        .insert({
          task_id: task.id,
          message: 'Your task was reset by leadership. Please accept and complete it again.',
          created_by: user.id
        });

      toast({ 
        title: 'Task Reset', 
        description: 'Task restored to Today\'s Task panel.' 
      });
      setDeleteConfirmTask(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Delete task permanently - TL/VC only
  const handleDeleteTask = async (taskId: string) => {
    try {
      await supabase.from('task_documents').delete().eq('task_id', taskId);
      await supabase.from('task_alerts').delete().eq('task_id', taskId);
      
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast({ title: 'Task Deleted', description: 'Task permanently removed.' });
      setDeleteConfirmTask(null);
      fetchData();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  // Export personal log with validation
  const handleExport = (exportFormat: 'csv' | 'xlsx') => {
    const validation = validateExportDateRange(fromDate, toDate);
    if (!validation.isValid) {
      setExportError(validation.error);
      return;
    }
    setExportError(null);

    let dataToExport = completedTasks;

    // Apply date range filter if specified
    if (fromDate || toDate) {
      dataToExport = dataToExport.filter(task => {
        const taskDate = task.completed_at ? new Date(task.completed_at) : null;
        if (!taskDate) return false;
        
        if (fromDate && taskDate < parseISO(fromDate)) return false;
        if (toDate && taskDate > parseISO(toDate + 'T23:59:59')) return false;
        return true;
      });
    }

    if (dataToExport.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No tasks match the selected filters.' });
      return;
    }

    const exportData = dataToExport.map(task => ({
      'Date': task.completed_at ? format(new Date(task.completed_at), 'yyyy-MM-dd') : '-',
      'Task': task.title,
      'Assigned By': task.assigner_name ? `${task.assigner_name}${task.assigner_role ? ` (${task.assigner_role})` : ''}` : '-',
      'Start Time': task.accepted_at ? format(new Date(task.accepted_at), 'HH:mm') : '-',
      'End Time': task.completed_at ? format(new Date(task.completed_at), 'HH:mm') : '-',
      'Duration (min)': task.duration_minutes || '-',
      'Documentation URL': taskDocs.get(task.id) || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Personal Log');

    const dateRange = fromDate && toDate 
      ? `${fromDate}_to_${toDate}` 
      : fromDate 
        ? `from_${fromDate}` 
        : toDate 
          ? `to_${toDate}` 
          : 'full_history';

    const username = profile?.full_name?.replace(/\s+/g, '_') || 'user';
    const filename = `Krypton_Log_${username}_${dateRange}.${exportFormat}`;
    XLSX.writeFile(wb, filename);

    toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
    setShowExportDialog(false);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Calculate task stats for the ID card
  const taskStats = {
    total: stats.accepted,
    completed: stats.completed,
    inProgress: inProgressTasks.length > 0
  };

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
                taskStats={taskStats}
                isOwnProfile={true}
                manualStatusOverride={manualStatusOverride}
                onToggleStatus={async () => {
                  setManualStatusOverride(!manualStatusOverride);
                  toast({ 
                    title: manualStatusOverride ? 'Status: Offline' : 'Status: Active',
                    description: 'This is a presence indicator only. Does not affect tasks.'
                  });
                }}
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
                  <RefreshButton onClick={handleManualRefresh} isRefreshing={isRefreshing} />
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
                        <TableHead>Action</TableHead>
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
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={() => handleComplete(task)}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" /> Complete
                            </Button>
                          </TableCell>
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
                <CardTitle className="flex items-center justify-between font-display">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-[hsl(var(--status-completed))]" />
                    Personal Log
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowExportDialog(true)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
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
                        {isCaptainOrVice && <TableHead>Actions</TableHead>}
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
                          {isCaptainOrVice && (
                            <TableCell>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                                onClick={() => setDeleteConfirmTask(task)}
                                title="Reset/Delete Task"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          )}
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

      {/* Delete/Reset Confirmation Dialog */}
      <Dialog open={!!deleteConfirmTask} onOpenChange={(open) => !open && setDeleteConfirmTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Task Action</DialogTitle>
            <DialogDescription>
              Choose an action for this task.
            </DialogDescription>
          </DialogHeader>
          {deleteConfirmTask && (
            <div className="space-y-4 pt-4">
              <div className="p-3 rounded bg-muted">
                <p className="font-medium">{deleteConfirmTask.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Status: {deleteConfirmTask.status}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline"
                  onClick={() => handleResetTask(deleteConfirmTask)}
                  className="w-full"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset to Today's Task
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => handleDeleteTask(deleteConfirmTask.id)}
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
          )}
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Personal Log</DialogTitle>
            <DialogDescription>
              Select date range and format for export.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From Date</Label>
                <Input 
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div>
                <Label>To Date</Label>
                <Input 
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave dates empty to export full history
            </p>
            <div className="flex gap-2">
              <Button onClick={() => handleExport('xlsx')} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Export XLSX
              </Button>
              <Button onClick={() => handleExport('csv')} variant="outline" className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MySpace;

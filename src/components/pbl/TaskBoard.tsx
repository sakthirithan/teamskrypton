import { useState, memo, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ProjectTask,
  ProjectTaskStatus,
  PriorityLevel,
  useCreateProjectTask,
  useUpdateProjectTask,
  useDeleteProjectTask,
} from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Plus, CheckCircle2, Circle, Clock, Eye, Trash2, Loader2, User } from 'lucide-react';

interface TaskBoardProps {
  projectId: string;
  milestoneId: string;
  tasks: ProjectTask[];
  profiles: { user_id: string; full_name: string }[];
}

const columns: { key: ProjectTaskStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'todo', label: 'To Do', icon: <Circle className="w-3.5 h-3.5" /> },
  { key: 'in_progress', label: 'In Progress', icon: <Clock className="w-3.5 h-3.5 text-primary" /> },
  { key: 'review', label: 'Review', icon: <Eye className="w-3.5 h-3.5 text-[hsl(var(--warning))]" /> },
  { key: 'done', label: 'Done', icon: <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--success))]" /> },
];

const priorityColors: Record<PriorityLevel, string> = {
  low: 'bg-secondary text-secondary-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]',
  critical: 'bg-destructive/10 text-destructive',
};

export const TaskBoard = memo(function TaskBoard({ projectId, milestoneId, tasks, profiles }: TaskBoardProps) {
  const { user, isLeadership } = useAuth();
  const createTask = useCreateProjectTask();
  const updateTask = useUpdateProjectTask();
  const deleteTask = useDeleteProjectTask();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('medium');

  const tasksByStatus = useMemo(() => {
    const map: Record<ProjectTaskStatus, ProjectTask[]> = {
      todo: [], in_progress: [], review: [], done: [],
    };
    tasks.forEach(t => {
      if (map[t.status]) map[t.status].push(t);
    });
    return map;
  }, [tasks]);

  const getName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    return profiles.find(p => p.user_id === userId)?.full_name || 'Unknown';
  };

  const handleCreate = async () => {
    if (!user || !newTitle) return;
    await createTask.mutateAsync({
      milestone_id: milestoneId,
      project_id: projectId,
      title: newTitle,
      assigned_to: newAssignee || undefined,
      priority: newPriority,
      created_by: user.id,
    });
    setNewTitle('');
    setNewAssignee('');
    setShowAdd(false);
  };

  const handleStatusChange = (taskId: string, newStatus: ProjectTaskStatus) => {
    updateTask.mutate({
      id: taskId,
      status: newStatus,
      ...(newStatus === 'done' ? { completed_at: new Date().toISOString() } : { completed_at: null }),
    });
  };

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tasks</h3>
        <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)} className="h-7 text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Task
        </Button>
      </div>

      {/* Quick Add */}
      {showAdd && (
        <Card className="border-dashed">
          <CardContent className="p-3 space-y-2">
            <Input
              placeholder="Task title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Select value={newAssignee} onValueChange={setNewAssignee}>
                <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Assign to..." /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id} className="text-xs">{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={newPriority} onValueChange={(v: PriorityLevel) => setNewPriority(v)}>
                <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="text-xs">Low</SelectItem>
                  <SelectItem value="medium" className="text-xs">Medium</SelectItem>
                  <SelectItem value="high" className="text-xs">High</SelectItem>
                  <SelectItem value="critical" className="text-xs">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!newTitle || createTask.isPending} className="h-7 text-xs flex-1">
                {createTask.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create Task'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowAdd(false)} className="h-7 text-xs">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {columns.map(col => (
          <div key={col.key} className="space-y-2">
            <div className="flex items-center gap-1.5 pb-2 border-b border-border">
              {col.icon}
              <span className="text-xs font-medium">{col.label}</span>
              <Badge variant="secondary" className="text-[10px] ml-auto h-4 px-1.5">
                {tasksByStatus[col.key].length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {tasksByStatus[col.key].map(task => (
                <Card key={task.id} className="group">
                  <CardContent className="p-2.5 space-y-1.5">
                    <p className="text-xs font-medium leading-tight">{task.title}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className={`text-[9px] h-4 ${priorityColors[task.priority]}`}>
                        {task.priority}
                      </Badge>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <User className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[60px]">{getName(task.assigned_to)}</span>
                      </div>
                    </div>
                    {/* Status Selector */}
                    <Select
                      value={task.status}
                      onValueChange={(v: ProjectTaskStatus) => handleStatusChange(task.id, v)}
                    >
                      <SelectTrigger className="h-6 text-[10px] border-none bg-muted/50 p-1 px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map(c => (
                          <SelectItem key={c.key} value={c.key} className="text-xs">{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
              {tasksByStatus[col.key].length === 0 && (
                <div className="text-[10px] text-muted-foreground text-center py-4 border border-dashed border-border/50 rounded-lg">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

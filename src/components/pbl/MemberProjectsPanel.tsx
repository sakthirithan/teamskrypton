import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  FolderKanban, Plus, Edit2, Trash2, CheckCircle, Circle, Clock,
  Eye, ChevronDown, ChevronRight, Milestone as MilestoneIcon, ListTodo
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  useCreateProjectTask, useUpdateProjectTask, useDeleteProjectTask,
  useCreateMilestone, useUpdateMilestone, useDeleteMilestone,
  type Project, type Milestone, type ProjectTask, type ProjectTaskStatus, type PriorityLevel
} from '@/hooks/useProjects';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

interface MemberProjectsPanelProps {
  memberId: string;
  memberName: string;
}

const STATUS_CONFIG: Record<ProjectTaskStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  todo: { label: 'Todo', color: 'bg-muted text-muted-foreground', icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Clock },
  review: { label: 'Review', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Eye },
  done: { label: 'Done', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle },
};

const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-muted text-muted-foreground' },
  medium: { label: 'Medium', color: 'bg-blue-500/10 text-blue-600' },
  high: { label: 'High', color: 'bg-amber-500/10 text-amber-600' },
  critical: { label: 'Critical', color: 'bg-red-500/10 text-red-600' },
};

export function MemberProjectsPanel({ memberId, memberName }: MemberProjectsPanelProps) {
  const { user, isLeadership, isCaptainOrVice } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createTask = useCreateProjectTask();
  const updateTask = useUpdateProjectTask();
  const deleteTask = useDeleteProjectTask();
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();

  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [selectedProjectForTask, setSelectedProjectForTask] = useState<{ projectId: string; milestoneId: string } | null>(null);

  const [taskForm, setTaskForm] = useState({
    title: '', description: '', priority: 'medium' as PriorityLevel,
    due_date: '', milestone_id: '',
  });

  // Fetch projects where this member is a participant
  const { data: memberProjects = [], isLoading } = useQuery({
    queryKey: ['member-projects', memberId],
    queryFn: async () => {
      // Get project memberships
      const { data: memberships, error: memError } = await supabase
        .from('project_members')
        .select('project_id, role')
        .eq('user_id', memberId);
      if (memError) throw memError;
      if (!memberships?.length) return [];

      const projectIds = memberships.map(m => m.project_id);
      const { data: projects, error: projError } = await supabase
        .from('projects')
        .select('*')
        .in('id', projectIds)
        .order('updated_at', { ascending: false });
      if (projError) throw projError;

      // Fetch tasks assigned to this member across these projects
      const { data: tasks, error: taskError } = await supabase
        .from('project_tasks')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });
      if (taskError) throw taskError;

      // Fetch milestones for these projects
      const { data: milestones, error: msError } = await supabase
        .from('milestones')
        .select('*')
        .in('project_id', projectIds)
        .order('sort_order', { ascending: true });
      if (msError) throw msError;

      const roleMap = new Map(memberships.map(m => [m.project_id, m.role]));

      return (projects || []).map(p => ({
        ...p,
        memberRole: roleMap.get(p.id) || 'member',
        tasks: (tasks || []).filter(t => t.project_id === p.id),
        memberTasks: (tasks || []).filter(t => t.project_id === p.id && t.assigned_to === memberId),
        milestones: (milestones || []).filter(m => m.project_id === p.id),
      })) as (Project & {
        memberRole: string;
        tasks: ProjectTask[];
        memberTasks: ProjectTask[];
        milestones: Milestone[];
      })[];
    },
    enabled: !!memberId,
  });

  const handleAddTask = async () => {
    if (!selectedProjectForTask || !taskForm.title.trim() || !user) return;
    await createTask.mutateAsync({
      project_id: selectedProjectForTask.projectId,
      milestone_id: taskForm.milestone_id || selectedProjectForTask.milestoneId,
      title: taskForm.title.trim(),
      description: taskForm.description || undefined,
      priority: taskForm.priority,
      due_date: taskForm.due_date || undefined,
      assigned_to: memberId,
      created_by: user.id,
    });
    queryClient.invalidateQueries({ queryKey: ['member-projects', memberId] });
    resetTaskForm();
    setIsAddTaskOpen(false);
  };

  const handleEditTask = async () => {
    if (!editingTask || !taskForm.title.trim()) return;
    await updateTask.mutateAsync({
      id: editingTask.id,
      title: taskForm.title.trim(),
      description: taskForm.description || undefined,
      priority: taskForm.priority,
      due_date: taskForm.due_date || undefined,
    });
    queryClient.invalidateQueries({ queryKey: ['member-projects', memberId] });
    setEditingTask(null);
    setIsEditTaskOpen(false);
    resetTaskForm();
  };

  const handleDeleteTask = async (task: ProjectTask) => {
    await deleteTask.mutateAsync({
      id: task.id,
      projectId: task.project_id,
      milestoneId: task.milestone_id,
    });
    queryClient.invalidateQueries({ queryKey: ['member-projects', memberId] });
  };

  const handleStatusChange = async (task: ProjectTask, newStatus: ProjectTaskStatus) => {
    await updateTask.mutateAsync({
      id: task.id,
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    });
    queryClient.invalidateQueries({ queryKey: ['member-projects', memberId] });
  };

  const resetTaskForm = () => {
    setTaskForm({ title: '', description: '', priority: 'medium', due_date: '', milestone_id: '' });
  };

  const openEditTask = (task: ProjectTask) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      due_date: task.due_date || '',
      milestone_id: task.milestone_id,
    });
    setIsEditTaskOpen(true);
  };

  const openAddTask = (projectId: string, milestoneId: string) => {
    setSelectedProjectForTask({ projectId, milestoneId });
    resetTaskForm();
    setTaskForm(f => ({ ...f, milestone_id: milestoneId }));
    setIsAddTaskOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Loading projects...
        </CardContent>
      </Card>
    );
  }

  const totalTasks = memberProjects.reduce((sum, p) => sum + p.memberTasks.length, 0);
  const doneTasks = memberProjects.reduce((sum, p) => sum + p.memberTasks.filter(t => t.status === 'done').length, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <FolderKanban className="w-5 h-5 text-primary" />
            Projects & Tasks
          </span>
          <div className="flex items-center gap-2">
            {totalTasks > 0 && (
              <Badge variant="outline" className="text-xs tabular-nums">
                {doneTasks}/{totalTasks} tasks done
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {memberProjects.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderKanban className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No projects assigned</p>
            <p className="text-xs mt-1">{memberName} is not part of any projects yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {memberProjects.map(project => {
              const isExpanded = expandedProject === project.id;
              const memberTasksDone = project.memberTasks.filter(t => t.status === 'done').length;
              const memberTasksTotal = project.memberTasks.length;
              const progress = memberTasksTotal > 0 ? (memberTasksDone / memberTasksTotal) * 100 : 0;

              return (
                <div key={project.id} className="border rounded-lg overflow-hidden">
                  {/* Project Header */}
                  <button
                    className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                    onClick={() => setExpandedProject(isExpanded ? null : project.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{project.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {project.status}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {project.memberRole}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <Progress value={progress} className="h-1.5 flex-1 max-w-[120px]" />
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {memberTasksDone}/{memberTasksTotal} tasks
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-xs"
                      onClick={(e) => { e.stopPropagation(); navigate(`/pbl/projects/${project.id}`); }}
                    >
                      Open
                    </Button>
                  </button>

                  {/* Expanded - Tasks by milestone */}
                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-3 space-y-3">
                      {project.milestones.map(milestone => {
                        const mTasks = project.memberTasks.filter(t => t.milestone_id === milestone.id);
                        return (
                          <div key={milestone.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                <MilestoneIcon className="w-3 h-3" />
                                {milestone.name}
                                <Badge variant="outline" className="text-[9px] px-1">
                                  {milestone.status.replace('_', ' ')}
                                </Badge>
                              </div>
                              {isLeadership && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-xs px-2"
                                  onClick={() => openAddTask(project.id, milestone.id)}
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Task
                                </Button>
                              )}
                            </div>

                            {mTasks.length === 0 ? (
                              <p className="text-xs text-muted-foreground pl-5">No tasks assigned in this milestone</p>
                            ) : (
                              <div className="space-y-1.5">
                                {mTasks.map(task => {
                                  const sc = STATUS_CONFIG[task.status];
                                  const pc = PRIORITY_CONFIG[task.priority];
                                  const StatusIcon = sc.icon;
                                  return (
                                    <div key={task.id} className="flex items-center gap-2 p-2 rounded-md bg-card border text-sm">
                                      {isLeadership ? (
                                        <Select
                                          value={task.status}
                                          onValueChange={(v) => handleStatusChange(task, v as ProjectTaskStatus)}
                                        >
                                          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent [&>svg]:hidden">
                                            <StatusIcon className={`w-4 h-4 ${
                                              task.status === 'done' ? 'text-emerald-500' :
                                              task.status === 'in_progress' ? 'text-blue-500' :
                                              task.status === 'review' ? 'text-amber-500' : 'text-muted-foreground'
                                            }`} />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                              <SelectItem key={key} value={key}>
                                                <span className="flex items-center gap-2">
                                                  <val.icon className="w-3 h-3" /> {val.label}
                                                </span>
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <StatusIcon className={`w-4 h-4 shrink-0 ${
                                          task.status === 'done' ? 'text-emerald-500' :
                                          task.status === 'in_progress' ? 'text-blue-500' :
                                          task.status === 'review' ? 'text-amber-500' : 'text-muted-foreground'
                                        }`} />
                                      )}

                                      <div className="flex-1 min-w-0">
                                        <span className={`text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                                          {task.title}
                                        </span>
                                        {task.due_date && (
                                          <span className="text-[10px] text-muted-foreground ml-2">
                                            Due {format(new Date(task.due_date), 'MMM d')}
                                          </span>
                                        )}
                                      </div>

                                      <Badge variant="outline" className={`text-[9px] px-1 ${pc.color}`}>
                                        {pc.label}
                                      </Badge>

                                      {isLeadership && (
                                        <div className="flex items-center gap-0.5 shrink-0">
                                          <Button size="icon" variant="ghost" className="h-6 w-6"
                                            onClick={() => openEditTask(task)}>
                                            <Edit2 className="w-3 h-3" />
                                          </Button>
                                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                                            onClick={() => handleDeleteTask(task)}>
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Tasks without a matching milestone (edge case) */}
                      {project.memberTasks.filter(t => !project.milestones.some(m => m.id === t.milestone_id)).length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                            <ListTodo className="w-3 h-3" /> Other Tasks
                          </p>
                          {project.memberTasks
                            .filter(t => !project.milestones.some(m => m.id === t.milestone_id))
                            .map(task => {
                              const sc = STATUS_CONFIG[task.status];
                              const StatusIcon = sc.icon;
                              return (
                                <div key={task.id} className="flex items-center gap-2 p-2 rounded-md bg-card border text-sm">
                                  <StatusIcon className={`w-4 h-4 shrink-0 ${
                                    task.status === 'done' ? 'text-emerald-500' : 'text-muted-foreground'
                                  }`} />
                                  <span className="flex-1 text-sm">{task.title}</span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Task Dialog */}
        <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Task to {memberName}</DialogTitle>
            </DialogHeader>
            <TaskFormFields
              form={taskForm}
              setForm={setTaskForm}
              milestones={selectedProjectForTask
                ? memberProjects.find(p => p.id === selectedProjectForTask.projectId)?.milestones || []
                : []
              }
              onSubmit={handleAddTask}
              isPending={createTask.isPending}
              submitLabel="Assign Task"
            />
          </DialogContent>
        </Dialog>

        {/* Edit Task Dialog */}
        <Dialog open={isEditTaskOpen} onOpenChange={(open) => { if (!open) { setIsEditTaskOpen(false); setEditingTask(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
            </DialogHeader>
            <TaskFormFields
              form={taskForm}
              setForm={setTaskForm}
              milestones={editingTask
                ? memberProjects.find(p => p.id === editingTask.project_id)?.milestones || []
                : []
              }
              onSubmit={handleEditTask}
              isPending={updateTask.isPending}
              submitLabel="Save Changes"
            />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

/** Reusable task form fields */
function TaskFormFields({ form, setForm, milestones, onSubmit, isPending, submitLabel }: {
  form: { title: string; description: string; priority: PriorityLevel; due_date: string; milestone_id: string };
  setForm: (fn: (prev: typeof form) => typeof form) => void;
  milestones: Milestone[];
  onSubmit: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Task Title *</Label>
        <Input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="e.g., Implement login page"
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Brief description..."
        />
      </div>
      {milestones.length > 0 && (
        <div className="space-y-2">
          <Label>Milestone</Label>
          <Select value={form.milestone_id} onValueChange={v => setForm(f => ({ ...f, milestone_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select milestone" /></SelectTrigger>
            <SelectContent>
              {milestones.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as PriorityLevel }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Due Date</Label>
          <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
        </div>
      </div>
      <Button onClick={onSubmit} className="w-full" disabled={!form.title.trim() || isPending}>
        {isPending ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );
}

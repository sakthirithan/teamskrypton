import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FolderKanban, Plus, Edit2, Trash2, CheckCircle, Circle, Clock,
  Eye, Milestone as MilestoneIcon, ListTodo, BarChart3,
  UserPlus, UserMinus, AlertTriangle, Activity, ArrowUpRight,
  Calendar, Target, TrendingUp
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  useCreateProjectTask, useUpdateProjectTask, useDeleteProjectTask,
  useCreateMilestone, useUpdateMilestone, useDeleteMilestone,
  useAddProjectMember, useRemoveProjectMember, useLogActivity,
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

const PROJECT_STATUS_COLORS: Record<string, string> = {
  planning: 'bg-muted text-muted-foreground',
  active: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  on_hold: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  archived: 'bg-muted text-muted-foreground',
};

export function MemberProjectsPanel({ memberId, memberName }: MemberProjectsPanelProps) {
  const { user, isLeadership } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createTask = useCreateProjectTask();
  const updateTask = useUpdateProjectTask();
  const deleteTask = useDeleteProjectTask();
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const logActivity = useLogActivity();

  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [isEditMilestoneOpen, setIsEditMilestoneOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [selectedProjectForTask, setSelectedProjectForTask] = useState<{ projectId: string; milestoneId: string } | null>(null);
  const [selectedProjectForMilestone, setSelectedProjectForMilestone] = useState<string | null>(null);
  const [activeProjectTab, setActiveProjectTab] = useState<string>('overview');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const [taskForm, setTaskForm] = useState({
    title: '', description: '', priority: 'medium' as PriorityLevel,
    due_date: '', milestone_id: '',
  });

  const [milestoneForm, setMilestoneForm] = useState({
    name: '', description: '', due_date: '',
  });

  // Fetch projects where this member is a participant
  const { data: memberProjects = [], isLoading } = useQuery({
    queryKey: ['member-projects', memberId],
    queryFn: async () => {
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

      const { data: tasks, error: taskError } = await supabase
        .from('project_tasks')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false });
      if (taskError) throw taskError;

      const { data: milestones, error: msError } = await supabase
        .from('milestones')
        .select('*')
        .in('project_id', projectIds)
        .order('sort_order', { ascending: true });
      if (msError) throw msError;

      const { data: allMembers, error: allMemError } = await supabase
        .from('project_members')
        .select('*')
        .in('project_id', projectIds);
      if (allMemError) throw allMemError;

      const { data: activities, error: actError } = await supabase
        .from('project_activity')
        .select('*')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .limit(20);

      const roleMap = new Map(memberships.map(m => [m.project_id, m.role]));

      return (projects || []).map(p => ({
        ...p,
        memberRole: roleMap.get(p.id) || 'member',
        tasks: (tasks || []).filter(t => t.project_id === p.id),
        memberTasks: (tasks || []).filter(t => t.project_id === p.id && t.assigned_to === memberId),
        milestones: (milestones || []).filter(m => m.project_id === p.id),
        members: (allMembers || []).filter(m => m.project_id === p.id),
        activities: (activities || []).filter(a => a.project_id === p.id),
      })) as (Project & {
        memberRole: string;
        tasks: ProjectTask[];
        memberTasks: ProjectTask[];
        milestones: Milestone[];
        members: { id: string; project_id: string; user_id: string; role: string; joined_at: string }[];
        activities: { id: string; project_id: string; user_id: string; action: string; details: any; created_at: string }[];
      })[];
    },
    enabled: !!memberId,
  });

  // Fetch profiles for member names
  const { data: profiles = [] } = useQuery({
    queryKey: ['all-profiles-mini'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('is_test', false);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
  const getName = (userId: string) => profileMap.get(userId) || 'Unknown';

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['member-projects', memberId] });
  };

  // ============ Task CRUD ============
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
    await logActivity.mutateAsync({
      project_id: selectedProjectForTask.projectId,
      user_id: user.id,
      action: 'task_created',
      details: { title: taskForm.title.trim(), assigned_to: memberName },
    });
    invalidateAll();
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
      milestone_id: taskForm.milestone_id || undefined,
    });
    invalidateAll();
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
    invalidateAll();
    toast({ title: 'Task deleted' });
  };

  const handleStatusChange = async (task: ProjectTask, newStatus: ProjectTaskStatus) => {
    await updateTask.mutateAsync({
      id: task.id,
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
    });
    if (newStatus === 'done' && user) {
      await logActivity.mutateAsync({
        project_id: task.project_id,
        user_id: user.id,
        action: 'task_completed',
        details: { title: task.title, completed_by: memberName },
      });
    }
    invalidateAll();
  };

  // ============ Milestone CRUD ============
  const handleAddMilestone = async () => {
    if (!selectedProjectForMilestone || !milestoneForm.name.trim()) return;
    const proj = memberProjects.find(p => p.id === selectedProjectForMilestone);
    await createMilestone.mutateAsync({
      project_id: selectedProjectForMilestone,
      name: milestoneForm.name.trim(),
      description: milestoneForm.description || undefined,
      due_date: milestoneForm.due_date || undefined,
      sort_order: (proj?.milestones.length || 0) + 1,
    });
    invalidateAll();
    setMilestoneForm({ name: '', description: '', due_date: '' });
    setIsAddMilestoneOpen(false);
  };

  const handleEditMilestone = async () => {
    if (!editingMilestone || !milestoneForm.name.trim()) return;
    await updateMilestone.mutateAsync({
      id: editingMilestone.id,
      name: milestoneForm.name.trim(),
      description: milestoneForm.description || undefined,
      due_date: milestoneForm.due_date || undefined,
    });
    invalidateAll();
    setEditingMilestone(null);
    setIsEditMilestoneOpen(false);
    setMilestoneForm({ name: '', description: '', due_date: '' });
  };

  const handleDeleteMilestone = async (milestone: Milestone) => {
    await deleteMilestone.mutateAsync({
      id: milestone.id,
      projectId: milestone.project_id,
    });
    invalidateAll();
    toast({ title: 'Milestone deleted' });
  };

  const handleMilestoneStatusChange = async (milestone: Milestone, newStatus: string) => {
    await updateMilestone.mutateAsync({
      id: milestone.id,
      status: newStatus as any,
    });
    invalidateAll();
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

  const openEditMilestone = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setMilestoneForm({
      name: milestone.name,
      description: milestone.description || '',
      due_date: milestone.due_date || '',
    });
    setIsEditMilestoneOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Loading projects...</CardContent></Card>
      </div>
    );
  }

  // Aggregate stats
  const totalProjects = memberProjects.length;
  const totalTasks = memberProjects.reduce((sum, p) => sum + p.memberTasks.length, 0);
  const doneTasks = memberProjects.reduce((sum, p) => sum + p.memberTasks.filter(t => t.status === 'done').length, 0);
  const inProgressTasks = memberProjects.reduce((sum, p) => sum + p.memberTasks.filter(t => t.status === 'in_progress').length, 0);
  const reviewTasks = memberProjects.reduce((sum, p) => sum + p.memberTasks.filter(t => t.status === 'review').length, 0);
  const overdueTasks = memberProjects.reduce((sum, p) => sum + p.memberTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length, 0);
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const activeProject = selectedProject ? memberProjects.find(p => p.id === selectedProject) : null;

  if (totalProjects === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No Projects Assigned</p>
          <p className="text-sm mt-1">{memberName} is not part of any projects yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderKanban className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{totalProjects}</p>
                <p className="text-xs text-muted-foreground">Projects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{doneTasks}<span className="text-sm font-normal text-muted-foreground">/{totalTasks}</span></p>
                <p className="text-xs text-muted-foreground">Tasks Done</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{completionRate}%</p>
                <p className="text-xs text-muted-foreground">Completion</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${overdueTasks > 0 ? 'bg-red-500/10' : 'bg-muted'}`}>
                <AlertTriangle className={`w-4 h-4 ${overdueTasks > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{overdueTasks}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-primary" />
              Projects
            </span>
            <Badge variant="outline" className="text-xs">
              {inProgressTasks} in progress · {reviewTasks} in review
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberProjects.map(project => {
                const memberTasksDone = project.memberTasks.filter(t => t.status === 'done').length;
                const memberTasksTotal = project.memberTasks.length;
                const progress = memberTasksTotal > 0 ? Math.round((memberTasksDone / memberTasksTotal) * 100) : 0;

                return (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedProject(selectedProject === project.id ? null : project.id)}
                  >
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${PROJECT_STATUS_COLORS[project.status] || ''}`}>
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{project.memberRole}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Progress value={progress} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground tabular-nums w-8">{progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.deadline ? format(new Date(project.deadline), 'MMM d') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={(e) => { e.stopPropagation(); navigate(`/pbl/projects/${project.id}`); }}
                      >
                        <ArrowUpRight className="w-3 h-3 mr-1" />
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Selected Project Detail Panel */}
      {activeProject && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary" />
                {activeProject.name}
              </span>
              <div className="flex items-center gap-2">
                {isLeadership && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSelectedProjectForMilestone(activeProject.id);
                      setMilestoneForm({ name: '', description: '', due_date: '' });
                      setIsAddMilestoneOpen(true);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Milestone
                  </Button>
                )}
              </div>
            </CardTitle>
            {activeProject.description && (
              <p className="text-sm text-muted-foreground">{activeProject.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <Tabs value={activeProjectTab} onValueChange={setActiveProjectTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="overview" className="text-xs">
                  <Target className="w-3 h-3 mr-1" />
                  Milestones & Tasks
                </TabsTrigger>
                <TabsTrigger value="all-tasks" className="text-xs">
                  <ListTodo className="w-3 h-3 mr-1" />
                  All Tasks
                </TabsTrigger>
                <TabsTrigger value="activity" className="text-xs">
                  <Activity className="w-3 h-3 mr-1" />
                  Activity
                </TabsTrigger>
              </TabsList>

              {/* Milestones & Tasks Tab */}
              <TabsContent value="overview" className="mt-0 space-y-4">
                {activeProject.milestones.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <MilestoneIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No milestones yet. {isLeadership ? 'Click "+ Milestone" to create one.' : ''}
                  </div>
                ) : (
                  activeProject.milestones.map(milestone => {
                    const mTasks = activeProject.memberTasks.filter(t => t.milestone_id === milestone.id);
                    const allMilestoneTasks = activeProject.tasks.filter(t => t.milestone_id === milestone.id);
                    const msDone = allMilestoneTasks.filter(t => t.status === 'done').length;
                    const msTotal = allMilestoneTasks.length;
                    const msProgress = msTotal > 0 ? Math.round((msDone / msTotal) * 100) : 0;

                    return (
                      <div key={milestone.id} className="border rounded-lg overflow-hidden">
                        <div className="p-3 bg-muted/30 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MilestoneIcon className="w-4 h-4 text-primary" />
                            <span className="font-medium text-sm">{milestone.name}</span>
                            <Badge variant="outline" className={`text-[9px] px-1.5 ${
                              milestone.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                              milestone.status === 'in_progress' ? 'bg-blue-500/10 text-blue-600' :
                              milestone.status === 'overdue' ? 'bg-red-500/10 text-red-600' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {milestone.status.replace('_', ' ')}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {msDone}/{msTotal} tasks
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {milestone.due_date && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1 mr-2">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(milestone.due_date), 'MMM d')}
                              </span>
                            )}
                            {isLeadership && (
                              <>
                                <Select
                                  value={milestone.status}
                                  onValueChange={(v) => handleMilestoneStatusChange(milestone, v)}
                                >
                                  <SelectTrigger className="h-6 w-20 text-[10px] px-1.5">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="not_started">Not Started</SelectItem>
                                    <SelectItem value="in_progress">In Progress</SelectItem>
                                    <SelectItem value="completed">Completed</SelectItem>
                                    <SelectItem value="overdue">Overdue</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditMilestone(milestone)}>
                                  <Edit2 className="w-3 h-3" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDeleteMilestone(milestone)}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => openAddTask(activeProject.id, milestone.id)}>
                                  <Plus className="w-3 h-3 mr-1" />
                                  Task
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="px-3 pt-1">
                          <Progress value={msProgress} className="h-1" />
                        </div>
                        {/* Tasks */}
                        <div className="p-3 space-y-1.5">
                          {mTasks.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-2">No tasks assigned in this milestone</p>
                          ) : (
                            mTasks.map(task => <TaskRow key={task.id} task={task} isLeadership={isLeadership} onStatusChange={handleStatusChange} onEdit={openEditTask} onDelete={handleDeleteTask} />)
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* All Tasks Tab - Flat list */}
              <TabsContent value="all-tasks" className="mt-0">
                {activeProject.memberTasks.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">No tasks assigned to {memberName}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Milestone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Due</TableHead>
                        {isLeadership && <TableHead className="text-right">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeProject.memberTasks.map(task => {
                        const ms = activeProject.milestones.find(m => m.id === task.milestone_id);
                        const sc = STATUS_CONFIG[task.status];
                        const pc = PRIORITY_CONFIG[task.priority];
                        const StatusIcon = sc.icon;
                        return (
                          <TableRow key={task.id}>
                            <TableCell className={`font-medium ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
                              {task.title}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{ms?.name || '-'}</TableCell>
                            <TableCell>
                              {isLeadership ? (
                                <Select value={task.status} onValueChange={(v) => handleStatusChange(task, v as ProjectTaskStatus)}>
                                  <SelectTrigger className="h-7 w-28 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                                      <SelectItem key={key} value={key}>
                                        <span className="flex items-center gap-1.5">
                                          <val.icon className="w-3 h-3" /> {val.label}
                                        </span>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge variant="outline" className={`text-[10px] ${sc.color}`}>
                                  <StatusIcon className="w-3 h-3 mr-1" />{sc.label}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${pc.color}`}>{pc.label}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {task.due_date ? format(new Date(task.due_date), 'MMM d') : '-'}
                            </TableCell>
                            {isLeadership && (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-0.5">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTask(task)}>
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteTask(task)}>
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="mt-0">
                {activeProject.activities.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">No activity recorded yet</div>
                ) : (
                  <div className="space-y-3">
                    {activeProject.activities.slice(0, 15).map(activity => (
                      <div key={activity.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/30">
                        <div className="p-1.5 rounded-full bg-muted mt-0.5">
                          <Activity className="w-3 h-3 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{getName(activity.user_id)}</span>{' '}
                            <span className="text-muted-foreground">{activity.action.replace(/_/g, ' ')}</span>
                            {activity.details?.title && (
                              <span className="text-muted-foreground"> — "{activity.details.title}"</span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {format(new Date(activity.created_at), 'MMM d, HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Add Task Dialog */}
      <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Task to {memberName}</DialogTitle></DialogHeader>
          <TaskFormFields
            form={taskForm}
            setForm={setTaskForm}
            milestones={selectedProjectForTask ? memberProjects.find(p => p.id === selectedProjectForTask.projectId)?.milestones || [] : []}
            onSubmit={handleAddTask}
            isPending={createTask.isPending}
            submitLabel="Assign Task"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Task Dialog */}
      <Dialog open={isEditTaskOpen} onOpenChange={(open) => { if (!open) { setIsEditTaskOpen(false); setEditingTask(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          <TaskFormFields
            form={taskForm}
            setForm={setTaskForm}
            milestones={editingTask ? memberProjects.find(p => p.id === editingTask.project_id)?.milestones || [] : []}
            onSubmit={handleEditTask}
            isPending={updateTask.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>

      {/* Add Milestone Dialog */}
      <Dialog open={isAddMilestoneOpen} onOpenChange={setIsAddMilestoneOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Milestone</DialogTitle></DialogHeader>
          <MilestoneFormFields
            form={milestoneForm}
            setForm={setMilestoneForm}
            onSubmit={handleAddMilestone}
            isPending={createMilestone.isPending}
            submitLabel="Create Milestone"
          />
        </DialogContent>
      </Dialog>

      {/* Edit Milestone Dialog */}
      <Dialog open={isEditMilestoneOpen} onOpenChange={(open) => { if (!open) { setIsEditMilestoneOpen(false); setEditingMilestone(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Milestone</DialogTitle></DialogHeader>
          <MilestoneFormFields
            form={milestoneForm}
            setForm={setMilestoneForm}
            onSubmit={handleEditMilestone}
            isPending={updateMilestone.isPending}
            submitLabel="Save Changes"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Task Row Component */
function TaskRow({ task, isLeadership, onStatusChange, onEdit, onDelete }: {
  task: ProjectTask;
  isLeadership: boolean;
  onStatusChange: (task: ProjectTask, status: ProjectTaskStatus) => void;
  onEdit: (task: ProjectTask) => void;
  onDelete: (task: ProjectTask) => void;
}) {
  const sc = STATUS_CONFIG[task.status];
  const pc = PRIORITY_CONFIG[task.priority];
  const StatusIcon = sc.icon;

  return (
    <div className="flex items-center gap-2 p-2 rounded-md bg-card border text-sm">
      {isLeadership ? (
        <Select value={task.status} onValueChange={(v) => onStatusChange(task, v as ProjectTaskStatus)}>
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
                <span className="flex items-center gap-2"><val.icon className="w-3 h-3" /> {val.label}</span>
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
      <Badge variant="outline" className={`text-[9px] px-1 ${pc.color}`}>{pc.label}</Badge>
      {isLeadership && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(task)}>
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(task)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
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
        <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Implement login page" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." />
      </div>
      {milestones.length > 0 && (
        <div className="space-y-2">
          <Label>Milestone</Label>
          <Select value={form.milestone_id} onValueChange={v => setForm(f => ({ ...f, milestone_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Select milestone" /></SelectTrigger>
            <SelectContent>
              {milestones.map(m => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
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

/** Reusable milestone form fields */
function MilestoneFormFields({ form, setForm, onSubmit, isPending, submitLabel }: {
  form: { name: string; description: string; due_date: string };
  setForm: (fn: (prev: typeof form) => typeof form) => void;
  onSubmit: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-2">
        <Label>Milestone Name *</Label>
        <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Phase 1 - Setup" />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What does this milestone cover?" />
      </div>
      <div className="space-y-2">
        <Label>Due Date</Label>
        <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
      </div>
      <Button onClick={onSubmit} className="w-full" disabled={!form.name.trim() || isPending}>
        {isPending ? 'Saving...' : submitLabel}
      </Button>
    </div>
  );
}

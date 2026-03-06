import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
export type MilestoneStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue';
export type ProjectTaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  status: ProjectStatus;
  priority: PriorityLevel;
  start_date: string;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  is_test: boolean;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: string;
  joined_at: string;
}

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectTask {
  id: string;
  milestone_id: string;
  project_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  status: ProjectTaskStatus;
  priority: PriorityLevel;
  due_date: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectActivity {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  details: Record<string, any> | null;
  created_at: string;
}

// ============ Projects ============
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Project[];
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Project | null;
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (project: {
      name: string;
      description?: string;
      owner_id: string;
      priority?: PriorityLevel;
      start_date?: string;
      deadline?: string;
    }) => {
      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Project created successfully' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
      toast({ title: 'Project updated' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Project deleted' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });
}

// ============ Project Members ============
export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-members', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId);
      if (error) throw error;
      return (data || []) as ProjectMember[];
    },
    enabled: !!projectId,
  });
}

export function useAddProjectMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (member: { project_id: string; user_id: string; role?: string }) => {
      const { data, error } = await supabase
        .from('project_members')
        .insert(member)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectMember;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-members', data.project_id] });
    },
  });
}

export function useRemoveProjectMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('project_members').delete().eq('id', id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
    },
  });
}

// ============ Milestones ============
export function useMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as Milestone[];
    },
    enabled: !!projectId,
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (milestone: {
      project_id: string;
      name: string;
      description?: string;
      due_date?: string;
      sort_order?: number;
    }) => {
      const { data, error } = await supabase
        .from('milestones')
        .insert(milestone)
        .select()
        .single();
      if (error) throw error;
      return data as Milestone;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', data.project_id] });
      toast({ title: 'Milestone created' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Milestone> & { id: string }) => {
      const { data, error } = await supabase
        .from('milestones')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Milestone;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', data.project_id] });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('milestones').delete().eq('id', id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', projectId] });
    },
  });
}

// ============ Project Tasks ============
export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectTask[];
    },
    enabled: !!projectId,
  });
}

export function useMilestoneTasks(milestoneId: string | undefined) {
  return useQuery({
    queryKey: ['milestone-tasks', milestoneId],
    queryFn: async () => {
      if (!milestoneId) return [];
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*')
        .eq('milestone_id', milestoneId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ProjectTask[];
    },
    enabled: !!milestoneId,
  });
}

export function useCreateProjectTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (task: {
      milestone_id: string;
      project_id: string;
      title: string;
      description?: string;
      assigned_to?: string;
      priority?: PriorityLevel;
      due_date?: string;
      created_by: string;
    }) => {
      const { data, error } = await supabase
        .from('project_tasks')
        .insert(task)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectTask;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['milestone-tasks', data.milestone_id] });
      toast({ title: 'Task created' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });
}

export function useUpdateProjectTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProjectTask> & { id: string }) => {
      const { data, error } = await supabase
        .from('project_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectTask;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['milestone-tasks', data.milestone_id] });
    },
  });
}

export function useDeleteProjectTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId, milestoneId }: { id: string; projectId: string; milestoneId: string }) => {
      const { error } = await supabase.from('project_tasks').delete().eq('id', id);
      if (error) throw error;
      return { projectId, milestoneId };
    },
    onSuccess: ({ projectId, milestoneId }) => {
      queryClient.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      queryClient.invalidateQueries({ queryKey: ['milestone-tasks', milestoneId] });
    },
  });
}

// ============ Activity Log ============
export function useProjectActivity(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-activity', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_activity')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ProjectActivity[];
    },
    enabled: !!projectId,
  });
}

export function useLogActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (activity: {
      project_id: string;
      user_id: string;
      action: string;
      details?: Record<string, any>;
    }) => {
      const { error } = await supabase.from('project_activity').insert(activity);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project-activity', variables.project_id] });
    },
  });
}

// ============ Profiles (for member names) ============
export function useAllProfiles() {
  return useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, department, avatar_url')
        .eq('is_test', false);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============ Analytics Helpers ============
export function calculateProjectHealth(
  tasks: ProjectTask[],
  milestones: Milestone[],
  deadline: string | null
): { score: number; label: 'healthy' | 'risk' | 'delayed' } {
  if (tasks.length === 0) return { score: 100, label: 'healthy' };

  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const taskRate = (completedTasks / tasks.length) * 100;

  const completedMilestones = milestones.filter(m => m.status === 'completed').length;
  const milestoneRate = milestones.length > 0 ? (completedMilestones / milestones.length) * 100 : 100;

  let deadlineScore = 100;
  if (deadline) {
    const daysLeft = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) deadlineScore = 0;
    else if (daysLeft < 7) deadlineScore = 50;
  }

  const score = Math.round(taskRate * 0.5 + milestoneRate * 0.3 + deadlineScore * 0.2);

  if (score >= 70) return { score, label: 'healthy' };
  if (score >= 40) return { score, label: 'risk' };
  return { score, label: 'delayed' };
}

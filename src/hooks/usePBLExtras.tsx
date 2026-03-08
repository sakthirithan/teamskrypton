import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

// ============ Comments ============
export interface ProjectComment {
  id: string;
  project_id: string;
  task_id: string | null;
  parent_id: string | null;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function useProjectComments(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-comments', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ProjectComment[];
    },
    enabled: !!projectId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (comment: {
      project_id: string;
      user_id: string;
      content: string;
      task_id?: string;
      parent_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('project_comments')
        .insert(comment)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectComment;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-comments', data.project_id] });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('project_comments').delete().eq('id', id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['project-comments', projectId] });
    },
  });
}

// ============ Documents ============
export interface ProjectDocument {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  url: string;
  doc_type: string;
  uploaded_by: string;
  created_at: string;
}

export function useProjectDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-documents', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectDocument[];
    },
    enabled: !!projectId,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (doc: {
      project_id: string;
      title: string;
      description?: string;
      url: string;
      doc_type?: string;
      uploaded_by: string;
    }) => {
      const { data, error } = await supabase
        .from('project_documents')
        .insert(doc)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectDocument;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', data.project_id] });
      toast({ title: 'Document added' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await supabase.from('project_documents').delete().eq('id', id);
      if (error) throw error;
      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
    },
  });
}

// ============ Notifications ============
export interface ProjectNotification {
  id: string;
  project_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export function useProjectNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['project-notifications', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('project_notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ProjectNotification[];
    },
    enabled: !!userId,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase
        .from('project_notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
      return userId;
    },
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: ['project-notifications', userId] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('project_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (error) throw error;
      return userId;
    },
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: ['project-notifications', userId] });
    },
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notification: {
      project_id: string;
      user_id: string;
      type: string;
      title: string;
      message?: string;
    }) => {
      const { error } = await supabase.from('project_notifications').insert(notification);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notifications'] });
    },
  });
}

// ============ All Documents across projects ============
export function useAllProjectDocuments() {
  return useQuery({
    queryKey: ['all-project-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProjectDocument[];
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface GlobalTodo {
  id: string;
  title: string;
  description: string | null;
  mode: string;
  created_by: string;
  is_global: boolean;
  session_id: string | null;
  parent_id: string | null;
  assigned_members: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface GlobalTodoCompletion {
  id: string;
  todo_id: string;
  user_id: string;
  completed_at: string;
}

export function useGlobalTodos(mode?: string) {
  const { user, isLeadership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const todosQuery = useQuery({
    queryKey: ['global-todos', mode],
    queryFn: async () => {
      let query = supabase
        .from('global_todos' as any)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      
      if (mode && mode !== 'all') {
        query = query.or(`mode.eq.${mode},mode.eq.all`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as GlobalTodo[];
    },
    enabled: !!user,
  });

  const completionsQuery = useQuery({
    queryKey: ['global-todo-completions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_todo_completions' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as GlobalTodoCompletion[];
    },
    enabled: !!user,
  });

  const profilesQuery = useQuery({
    queryKey: ['profiles-for-todos'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('is_test', false);
      return data || [];
    },
  });

  const createTodo = useMutation({
    mutationFn: async (input: { title: string; description?: string; mode?: string; is_global?: boolean; parent_id?: string; assigned_members?: string[] }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('global_todos' as any)
        .insert({
          title: input.title,
          description: input.description || null,
          mode: input.mode || 'all',
          created_by: user.id,
          is_global: input.is_global ?? false,
          parent_id: input.parent_id || null,
          assigned_members: input.assigned_members || [],
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-todos'] });
      toast({ title: 'To-do created' });
    },
  });

  const deleteTodo = useMutation({
    mutationFn: async (todoId: string) => {
      const { error } = await supabase.from('global_todos' as any).delete().eq('id', todoId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['global-todos'] }),
  });

  const toggleCompletion = useMutation({
    mutationFn: async (todoId: string) => {
      if (!user) throw new Error('Not authenticated');
      const existing = completionsQuery.data?.find(c => c.todo_id === todoId && c.user_id === user.id);
      if (existing) {
        const { error } = await supabase.from('global_todo_completions' as any).delete().eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('global_todo_completions' as any).insert({
          todo_id: todoId,
          user_id: user.id,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['global-todo-completions'] }),
  });

  const isCompleted = (todoId: string) => {
    return completionsQuery.data?.some(c => c.todo_id === todoId && c.user_id === user?.id) || false;
  };

  const getCompletions = (todoId: string) => {
    return completionsQuery.data?.filter(c => c.todo_id === todoId) || [];
  };

  const getUncompletedUsers = (todoId: string) => {
    const completed = new Set(getCompletions(todoId).map(c => c.user_id));
    return (profilesQuery.data || []).filter(p => !completed.has(p.user_id));
  };

  const parentTodos = (todosQuery.data || []).filter(t => !t.parent_id);
  const getSubtasks = (parentId: string) => (todosQuery.data || []).filter(t => t.parent_id === parentId);

  return {
    todos: todosQuery.data || [],
    parentTodos,
    getSubtasks,
    completions: completionsQuery.data || [],
    profiles: profilesQuery.data || [],
    isLoading: todosQuery.isLoading,
    createTodo,
    deleteTodo,
    toggleCompletion,
    isCompleted,
    getCompletions,
    getUncompletedUsers,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface DailyStudyItem {
  id: string;
  user_id: string;
  session_id: string;
  item_type: 'link' | 'todo';
  title: string;
  url: string | null;
  is_completed: boolean;
  created_at: string;
  expires_at: string;
}

export function useDailyStudyItems(sessionId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const key = ['daily-study-items', sessionId, user?.id];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      if (!sessionId || !user) return [];
      const { data, error } = await supabase
        .from('daily_study_items')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as DailyStudyItem[];
    },
    enabled: !!sessionId && !!user,
  });

  const addItem = useMutation({
    mutationFn: async (params: { item_type: 'link' | 'todo'; title: string; url?: string }) => {
      if (!sessionId || !user) throw new Error('Missing session or user');
      const { error } = await supabase.from('daily_study_items').insert({
        user_id: user.id,
        session_id: sessionId,
        item_type: params.item_type,
        title: params.title,
        url: params.url || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: 'Item added' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const toggleComplete = useMutation({
    mutationFn: async (params: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from('daily_study_items')
        .update({ is_completed: params.is_completed })
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('daily_study_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast({ title: 'Item removed' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  // Filter out expired items on the frontend as well
  const items = (query.data || []).filter(i => new Date(i.expires_at) > new Date());
  const links = items.filter(i => i.item_type === 'link');
  const todos = items.filter(i => i.item_type === 'todo');

  return { items, links, todos, isLoading: query.isLoading, addItem, toggleComplete, removeItem };
}

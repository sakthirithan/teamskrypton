import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface SkillReflection {
  id: string;
  skill_track_id: string;
  user_id: string;
  week_start: string;
  content: string;
  challenges: string | null;
  next_steps: string | null;
  created_at: string;
  updated_at: string;
}

export function useSkillReflections(trackId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reflectionsQuery = useQuery({
    queryKey: ['skill-reflections', trackId],
    queryFn: async () => {
      if (!trackId) return [];
      const { data, error } = await supabase
        .from('skill_reflections' as any)
        .select('*')
        .eq('skill_track_id', trackId)
        .order('week_start', { ascending: false });
      if (error) throw error;
      return data as unknown as SkillReflection[];
    },
    enabled: !!trackId,
  });

  const addReflection = useMutation({
    mutationFn: async (params: { week_start: string; content: string; challenges?: string; next_steps?: string }) => {
      if (!user || !trackId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('skill_reflections' as any)
        .insert({
          skill_track_id: trackId,
          user_id: user.id,
          week_start: params.week_start,
          content: params.content,
          challenges: params.challenges || null,
          next_steps: params.next_steps || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-reflections', trackId] });
      toast({ title: 'Reflection saved', description: 'Weekly reflection recorded.' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const updateReflection = useMutation({
    mutationFn: async (params: { id: string; content?: string; challenges?: string; next_steps?: string }) => {
      const { id, ...updates } = params;
      const { error } = await supabase
        .from('skill_reflections' as any)
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-reflections', trackId] });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const deleteReflection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('skill_reflections' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-reflections', trackId] });
      toast({ title: 'Reflection removed' });
    },
    onError: (e: Error) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  return {
    reflections: reflectionsQuery.data || [],
    isLoading: reflectionsQuery.isLoading,
    addReflection,
    updateReflection,
    deleteReflection,
  };
}

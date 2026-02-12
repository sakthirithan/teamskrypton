import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TargetScope } from '@/lib/groupingConstants';

export interface GroupingTarget {
  id: string;
  session_id: string;
  target_scope: TargetScope;
  user_id: string | null;
  target_points: number;
  achieved_points: number;
  editable: boolean;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useGroupingTargets(sessionId?: string) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const targetsQuery = useQuery({
    queryKey: ['grouping-targets', sessionId],
    queryFn: async () => {
      let query = supabase
        .from('grouping_targets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as GroupingTarget[];
    },
    enabled: !!user,
  });

  const myTargets = targetsQuery.data?.filter(
    t => t.target_scope === 'group' || t.user_id === user?.id
  ) || [];

  const createTarget = useMutation({
    mutationFn: async (target: {
      session_id: string;
      target_scope: TargetScope;
      user_id?: string | null;
      target_points: number;
      editable?: boolean;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('grouping_targets')
        .insert({
          session_id: target.session_id,
          target_scope: target.target_scope,
          user_id: target.user_id || null,
          target_points: target.target_points,
          editable: target.editable ?? false,
          notes: target.notes || null,
          created_by: user!.id,
          achieved_points: 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
      toast({ title: 'Target Created', description: 'New target has been assigned.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Get Targets For User
  const getTargetsForUser = (targetUserId?: string) => {
  if (!targetUserId) return [];

  return (
    targetsQuery.data?.filter(
      t =>
        t.target_scope === 'group' ||
        (t.target_scope === 'individual' && t.user_id === targetUserId)
    ) || []
  );
};


  const updateTarget = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GroupingTarget> & { id: string }) => {
      const { data, error } = await supabase
        .from('grouping_targets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
      toast({ title: 'Target Updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTarget = useMutation({
    mutationFn: async (targetId: string) => {
      const { error } = await supabase
        .from('grouping_targets')
        .delete()
        .eq('id', targetId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
      toast({ title: 'Target Deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    targets: targetsQuery.data || [],
    myTargets,
    getTargetsForUser,
    isLoading: targetsQuery.isLoading,
    error: targetsQuery.error,
    createTarget,
    updateTarget,
    deleteTarget,
    refetch: targetsQuery.refetch,
  };
}

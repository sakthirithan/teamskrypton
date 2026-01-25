import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface PSDailyEntry {
  id: string;
  s_no: number;
  session_id: string;
  user_id: string;
  entry_date: string;
  skill_name: string;
  reward_points: number;
  attempt_count: number;
  entered_by: string;
  created_at: string;
  updated_at: string;
}

export function usePSDailyEntries(sessionId?: string, userId?: string) {
  const { user, isLeadership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const entriesQuery = useQuery({
    queryKey: ['ps-daily-entries', sessionId, userId],
    queryFn: async () => {
      let query = supabase
        .from('ps_daily_entries')
        .select('*')
        .order('entry_date', { ascending: false })
        .order('s_no', { ascending: true });
      
      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }
      
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PSDailyEntry[];
    },
    enabled: !!user,
  });

  const createEntry = useMutation({
    mutationFn: async (entry: {
      session_id: string;
      user_id: string;
      entry_date: string;
      skill_name: string;
      reward_points: number;
      attempt_count?: number;
    }) => {
      // Get next s_no for the session
      const { data: entries } = await supabase
        .from('ps_daily_entries')
        .select('s_no')
        .eq('session_id', entry.session_id)
        .order('s_no', { ascending: false })
        .limit(1);
      
      const nextSNo = entries && entries.length > 0 
        ? (entries[0] as any).s_no + 1 
        : 1;

      const { data, error } = await supabase
        .from('ps_daily_entries')
        .insert({
          s_no: nextSNo,
          session_id: entry.session_id,
          user_id: entry.user_id,
          entry_date: entry.entry_date,
          skill_name: entry.skill_name,
          reward_points: entry.reward_points,
          attempt_count: entry.attempt_count ?? 1,
          entered_by: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
      toast({ title: 'Entry Added', description: 'PS daily entry has been recorded.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PSDailyEntry> & { id: string }) => {
      const { data, error } = await supabase
        .from('ps_daily_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
      toast({ title: 'Entry Updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from('ps_daily_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
      toast({ title: 'Entry Deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Calculate total points for a user in a session
  const getTotalPoints = (forUserId?: string) => {
    const targetUserId = forUserId || user?.id;
    return (entriesQuery.data || [])
      .filter(e => e.user_id === targetUserId)
      .reduce((sum, e) => sum + e.reward_points, 0);
  };

  return {
    entries: entriesQuery.data || [],
    isLoading: entriesQuery.isLoading,
    error: entriesQuery.error,
    createEntry,
    updateEntry,
    deleteEntry,
    getTotalPoints,
    refetch: entriesQuery.refetch,
  };
}

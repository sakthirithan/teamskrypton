import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type PSEntryStatus = 'pending' | 'completed' | 'attempt';

export interface PSDailyEntry {
  id: string;
  s_no: number;
  session_id: string;
  user_id: string;
  entry_date: string;
  entry_time: string | null;
  skill_name: string;
  reward_points: number;
  attempt_count: number;
  entered_by: string;
  status: PSEntryStatus;
  completed_at: string | null;
  completed_by: string | null;
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
      entry_time?: string;
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
          entry_time: entry.entry_time || null,
          skill_name: entry.skill_name,
          reward_points: entry.reward_points,
          attempt_count: entry.attempt_count ?? 1,
          entered_by: user!.id,
          status: 'pending', // Always start as pending
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      toast({ title: 'Entry Added', description: 'PS daily entry saved as pending.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PSDailyEntry> & { id: string }) => {
      // Only allow updating specific fields
      const allowedUpdates: Partial<PSDailyEntry> = {};
      if (updates.skill_name !== undefined) allowedUpdates.skill_name = updates.skill_name;
      if (updates.reward_points !== undefined) allowedUpdates.reward_points = updates.reward_points;
      if (updates.attempt_count !== undefined) allowedUpdates.attempt_count = updates.attempt_count;
      if (updates.entry_date !== undefined) allowedUpdates.entry_date = updates.entry_date;
      if (updates.entry_time !== undefined) allowedUpdates.entry_time = updates.entry_time;

      const { data, error } = await supabase
        .from('ps_daily_entries')
        .update(allowedUpdates)
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

  // Mark entry as completed
  const completeEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { data, error } = await supabase
        .from('ps_daily_entries')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user!.id,
        })
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
      toast({ title: 'Entry Completed', description: 'Points now count toward target.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Revert entry to pending (leadership only)
  const revertEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { data, error } = await supabase
        .from('ps_daily_entries')
        .update({
          status: 'pending',
          completed_at: null,
          completed_by: null,
        })
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
      toast({ title: 'Entry Reverted', description: 'Entry moved back to pending.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Mark entry as attempt (effort, not completion - does NOT count toward target)
  const attemptEntry = useMutation({
    mutationFn: async (entryId: string) => {
      const { data, error } = await supabase
        .from('ps_daily_entries')
        .update({
          status: 'attempt',
        })
        .eq('id', entryId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      toast({ title: 'Entry Marked as Attempt', description: 'Effort recorded. Does not count toward target.' });
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

  // Calculate total points for a user in a session - ONLY COMPLETED ENTRIES
  const getTotalPoints = (forUserId?: string) => {
    const targetUserId = forUserId || user?.id;
    return (entriesQuery.data || [])
      .filter(e => e.user_id === targetUserId && e.status === 'completed')
      .reduce((sum, e) => sum + e.reward_points, 0);
  };

  // Get pending entries count
  const getPendingCount = (forUserId?: string) => {
    const targetUserId = forUserId || user?.id;
    return (entriesQuery.data || [])
      .filter(e => e.user_id === targetUserId && e.status === 'pending').length;
  };

  // Get attempt entries count
  const getAttemptCount = (forUserId?: string) => {
    const targetUserId = forUserId || user?.id;
    return (entriesQuery.data || [])
      .filter(e => e.user_id === targetUserId && e.status === 'attempt').length;
  };

  return {
    entries: entriesQuery.data || [],
    isLoading: entriesQuery.isLoading,
    error: entriesQuery.error,
    createEntry,
    updateEntry,
    completeEntry,
    revertEntry,
    attemptEntry,
    deleteEntry,
    getTotalPoints,
    getPendingCount,
    getAttemptCount,
    refetch: entriesQuery.refetch,
  };
}

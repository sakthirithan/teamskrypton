import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface GroupingSession {
  id: string;
  session_number: number;
  name: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'closed';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useGroupingSessions() {
  const { user, isCaptainOrVice, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Permission check for session deletion (TL, VC, TM only - NOT Strategist)
  const canDeleteSession = isCaptainOrVice || role === 'team_manager';

  const sessionsQuery = useQuery({
    queryKey: ['grouping-sessions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grouping_sessions')
        .select('*')
        .order('session_number', { ascending: false });
      
      if (error) throw error;
      return data as GroupingSession[];
    },
    enabled: !!user,
  });

  const activeSession = sessionsQuery.data?.find(s => s.status === 'active');

  const createSession = useMutation({
    mutationFn: async (session: {
      name: string;
      start_date: string;
      end_date: string;
    }) => {
      // Get next session number
      const { data: sessions } = await supabase
        .from('grouping_sessions')
        .select('session_number')
        .order('session_number', { ascending: false })
        .limit(1);
      
      const nextNumber = sessions && sessions.length > 0 
        ? (sessions[0] as any).session_number + 1 
        : 1;

      const { data, error } = await supabase
        .from('grouping_sessions')
        .insert({
          session_number: nextNumber,
          name: session.name,
          start_date: session.start_date,
          end_date: session.end_date,
          created_by: user!.id,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-sessions'] });
      toast({ title: 'Session Created', description: 'New grouping session has been created.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateSession = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<GroupingSession> & { id: string }) => {
      const { data, error } = await supabase
        .from('grouping_sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-sessions'] });
      toast({ title: 'Session Updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const closeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase
        .from('grouping_sessions')
        .update({ status: 'closed' })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-sessions'] });
      toast({ title: 'Session Closed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Hard delete session - TL, VC, TM only
  const deleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!canDeleteSession) {
        throw new Error('You do not have permission to delete sessions');
      }

      // Delete session - CASCADE will handle targets, entries, notes
      const { error } = await supabase
        .from('grouping_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grouping-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['grouping-notes'] });
      toast({ title: 'Session Deleted', description: 'Session and all related data permanently deleted.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    sessions: sessionsQuery.data || [],
    activeSession,
    isLoading: sessionsQuery.isLoading,
    error: sessionsQuery.error,
    createSession,
    updateSession,
    closeSession,
    deleteSession,
    canDeleteSession,
    refetch: sessionsQuery.refetch,
  };
}

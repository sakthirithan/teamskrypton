import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ChallengeAssignment {
  id: string;
  challenge_id: string;
  user_id: string;
  assigned_at: string;
}

export function useChallengeAssignments(sessionId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const assignmentsQuery = useQuery({
    queryKey: ['challenge-assignments', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      // Get all challenge IDs for this session first
      const { data: challenges } = await supabase
        .from('skill_challenges' as any)
        .select('id')
        .eq('session_id', sessionId);
      if (!challenges || challenges.length === 0) return [];
      
      const ids = challenges.map((c: any) => c.id);
      const { data, error } = await supabase
        .from('challenge_assignments' as any)
        .select('*')
        .in('challenge_id', ids);
      if (error) throw error;
      return (data || []) as unknown as ChallengeAssignment[];
    },
    enabled: !!sessionId,
  });

  const assignMembers = useMutation({
    mutationFn: async ({ challengeId, userIds }: { challengeId: string; userIds: string[] }) => {
      // Delete existing assignments
      await supabase.from('challenge_assignments' as any).delete().eq('challenge_id', challengeId);
      // Insert new
      if (userIds.length > 0) {
        const rows = userIds.map(uid => ({ challenge_id: challengeId, user_id: uid }));
        const { error } = await supabase.from('challenge_assignments' as any).insert(rows as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenge-assignments', sessionId] });
    },
  });

  const getAssignmentsForChallenge = (challengeId: string) => {
    return (assignmentsQuery.data || []).filter(a => a.challenge_id === challengeId);
  };

  const isAssignedToMe = (challengeId: string) => {
    const assignments = getAssignmentsForChallenge(challengeId);
    // If no assignments, challenge is open to all
    if (assignments.length === 0) return true;
    return assignments.some(a => a.user_id === user?.id);
  };

  return {
    assignments: assignmentsQuery.data || [],
    assignMembers,
    getAssignmentsForChallenge,
    isAssignedToMe,
    isLoading: assignmentsQuery.isLoading,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SkillChallenge {
  id: string;
  session_id: string;
  title: string;
  description: string | null;
  xp_reward: number;
  difficulty: string;
  created_by: string;
  expires_at: string | null;
  created_at: string;
}

export interface ChallengeCompletion {
  id: string;
  challenge_id: string;
  user_id: string;
  proof_text: string | null;
  completed_at: string;
  approved_by: string | null;
  status: string;
}

export function useSkillChallenges(sessionId?: string) {
  const { user, isLeadership } = useAuth();
  const queryClient = useQueryClient();

  const challengesQuery = useQuery({
    queryKey: ['skill-challenges', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('skill_challenges' as any)
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SkillChallenge[];
    },
    enabled: !!sessionId,
  });

  const completionsQuery = useQuery({
    queryKey: ['skill-challenge-completions', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      // Get all challenge IDs for this session
      const challenges = challengesQuery.data || [];
      if (challenges.length === 0) return [];
      const ids = challenges.map(c => c.id);
      const { data, error } = await supabase
        .from('skill_challenge_completions' as any)
        .select('*')
        .in('challenge_id', ids);
      if (error) throw error;
      return (data || []) as unknown as ChallengeCompletion[];
    },
    enabled: !!sessionId && (challengesQuery.data?.length || 0) > 0,
  });

  const createChallenge = useMutation({
    mutationFn: async (input: { title: string; description?: string; xp_reward: number; difficulty: string; expires_at?: string }) => {
      if (!user || !sessionId) throw new Error('Missing context');
      const { error } = await supabase
        .from('skill_challenges' as any)
        .insert({
          session_id: sessionId,
          title: input.title,
          description: input.description || null,
          xp_reward: input.xp_reward,
          difficulty: input.difficulty,
          created_by: user.id,
          expires_at: input.expires_at || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-challenges', sessionId] });
    },
  });

  const submitCompletion = useMutation({
    mutationFn: async ({ challengeId, proofText }: { challengeId: string; proofText?: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('skill_challenge_completions' as any)
        .insert({
          challenge_id: challengeId,
          user_id: user.id,
          proof_text: proofText || null,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-challenge-completions', sessionId] });
    },
  });

  const approveCompletion = useMutation({
    mutationFn: async ({ completionId, approve }: { completionId: string; approve: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('skill_challenge_completions' as any)
        .update({
          status: approve ? 'approved' : 'rejected',
          approved_by: user.id,
        } as any)
        .eq('id', completionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-challenge-completions', sessionId] });
    },
  });

  const deleteChallenge = useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase
        .from('skill_challenges' as any)
        .delete()
        .eq('id', challengeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-challenges', sessionId] });
    },
  });

  const getUserCompletion = (challengeId: string) => {
    return completionsQuery.data?.find(c => c.challenge_id === challengeId && c.user_id === user?.id);
  };

  const getCompletionsForChallenge = (challengeId: string) => {
    return completionsQuery.data?.filter(c => c.challenge_id === challengeId) || [];
  };

  return {
    challenges: challengesQuery.data || [],
    completions: completionsQuery.data || [],
    isLoading: challengesQuery.isLoading,
    createChallenge,
    submitCompletion,
    approveCompletion,
    deleteChallenge,
    getUserCompletion,
    getCompletionsForChallenge,
  };
}

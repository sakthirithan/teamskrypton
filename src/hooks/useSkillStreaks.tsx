import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SkillStreak {
  id: string;
  user_id: string;
  session_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  total_active_days: number;
  created_at: string;
  updated_at: string;
}

export function useSkillStreaks(sessionId?: string, userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const streakQuery = useQuery({
    queryKey: ['skill-streak', sessionId, userId],
    queryFn: async () => {
      if (!sessionId || !userId) return null;
      const { data, error } = await supabase
        .from('skill_streaks' as any)
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SkillStreak | null;
    },
    enabled: !!sessionId && !!userId,
  });

  const recordActivity = useMutation({
    mutationFn: async () => {
      if (!user || !sessionId) throw new Error('Missing context');
      const today = new Date().toISOString().split('T')[0];
      const existing = streakQuery.data;

      if (existing) {
        if (existing.last_active_date === today) return existing; // already logged today

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const isConsecutive = existing.last_active_date === yesterdayStr;
        const newStreak = isConsecutive ? existing.current_streak + 1 : 1;
        const newLongest = Math.max(existing.longest_streak, newStreak);

        const { error } = await supabase
          .from('skill_streaks' as any)
          .update({
            current_streak: newStreak,
            longest_streak: newLongest,
            last_active_date: today,
            total_active_days: existing.total_active_days + 1,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('skill_streaks' as any)
          .insert({
            user_id: user.id,
            session_id: sessionId,
            current_streak: 1,
            longest_streak: 1,
            last_active_date: today,
            total_active_days: 1,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-streak', sessionId, userId] });
    },
  });

  return {
    streak: streakQuery.data,
    isLoading: streakQuery.isLoading,
    recordActivity,
  };
}

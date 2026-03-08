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

/**
 * Week-based streak tracker. Streak increments when the user updates
 * flowchart blocks (learning steps) on consecutive weeks. A "week" is
 * tracked via last_active_date which stores the Monday of the active week.
 */
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

  /** Call this when a user updates/creates a flowchart block */
  const recordWeekActivity = useMutation({
    mutationFn: async () => {
      if (!user || !sessionId) throw new Error('Missing context');

      // Get Monday of current week
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      const currentWeek = monday.toISOString().split('T')[0];

      const existing = streakQuery.data;

      if (existing) {
        if (existing.last_active_date === currentWeek) return existing; // already logged this week

        // Check if last active was the previous week
        const lastDate = new Date(existing.last_active_date || '');
        const prevMonday = new Date(monday);
        prevMonday.setDate(prevMonday.getDate() - 7);
        const prevWeekStr = prevMonday.toISOString().split('T')[0];

        const isConsecutive = existing.last_active_date === prevWeekStr;
        const newStreak = isConsecutive ? existing.current_streak + 1 : 1;
        const newLongest = Math.max(existing.longest_streak, newStreak);

        const { error } = await supabase
          .from('skill_streaks' as any)
          .update({
            current_streak: newStreak,
            longest_streak: newLongest,
            last_active_date: currentWeek,
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
            last_active_date: currentWeek,
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
    recordWeekActivity,
  };
}

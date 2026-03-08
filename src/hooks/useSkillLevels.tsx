import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SkillLevel {
  id: string;
  user_id: string;
  session_id: string;
  xp: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface SkillXpLog {
  id: string;
  user_id: string;
  session_id: string;
  xp_amount: number;
  activity_type: string;
  description: string | null;
  created_at: string;
}

// XP thresholds for each level
export const LEVEL_THRESHOLDS = [
  0,     // Level 1: 0 XP
  100,   // Level 2: 100 XP
  300,   // Level 3: 300 XP
  600,   // Level 4: 600 XP
  1000,  // Level 5: 1000 XP
  1500,  // Level 6: 1500 XP
  2200,  // Level 7: 2200 XP
  3000,  // Level 8: 3000 XP
  4000,  // Level 9: 4000 XP
  5200,  // Level 10: 5200 XP
];

export const LEVEL_NAMES = [
  'Beginner',
  'Novice',
  'Learner',
  'Practitioner',
  'Skilled',
  'Proficient',
  'Advanced',
  'Expert',
  'Master',
  'Grandmaster',
];

export const LEVEL_COLORS = [
  'text-muted-foreground',
  'text-emerald-500',
  'text-emerald-600',
  'text-blue-500',
  'text-blue-600',
  'text-purple-500',
  'text-purple-600',
  'text-amber-500',
  'text-amber-600',
  'text-red-500',
];

export const XP_REWARDS = {
  flowchart_step: 15,
  reflection: 25,
  endorsement_received: 10,
  dev_link: 10,
  streak_bonus: 20,
  ps_completed: 5,
  challenge_easy: 30,
  challenge_medium: 50,
  challenge_hard: 100,
};

export function getLevelFromXp(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getXpForNextLevel(level: number): number {
  if (level >= LEVEL_THRESHOLDS.length) return LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  return LEVEL_THRESHOLDS[level]; // level is 1-indexed, array is 0-indexed
}

export function getXpProgress(xp: number, level: number): number {
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  const range = nextThreshold - currentThreshold;
  if (range <= 0) return 100;
  return Math.min(100, ((xp - currentThreshold) / range) * 100);
}

export function useSkillLevels(sessionId?: string, userId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const targetUserId = userId || user?.id;

  const levelQuery = useQuery({
    queryKey: ['skill-level', sessionId, targetUserId],
    queryFn: async () => {
      if (!sessionId || !targetUserId) return null;
      const { data, error } = await supabase
        .from('skill_levels' as any)
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', targetUserId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SkillLevel | null;
    },
    enabled: !!sessionId && !!targetUserId,
  });

  const xpLogQuery = useQuery({
    queryKey: ['skill-xp-log', sessionId, targetUserId],
    queryFn: async () => {
      if (!sessionId || !targetUserId) return [];
      const { data, error } = await supabase
        .from('skill_xp_log' as any)
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as SkillXpLog[];
    },
    enabled: !!sessionId && !!targetUserId,
  });

  // Leaderboard: all users' levels for a session
  const leaderboardQuery = useQuery({
    queryKey: ['skill-leaderboard', sessionId],
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await supabase
        .from('skill_levels' as any)
        .select('*')
        .eq('session_id', sessionId)
        .order('xp', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as SkillLevel[];
    },
    enabled: !!sessionId,
  });

  const awardXp = useMutation({
    mutationFn: async ({ activityType, description, xpAmount }: { activityType: string; description?: string; xpAmount: number }) => {
      if (!user || !sessionId) throw new Error('Missing context');

      // Insert XP log
      const { error: logError } = await supabase
        .from('skill_xp_log' as any)
        .insert({
          user_id: user.id,
          session_id: sessionId,
          xp_amount: xpAmount,
          activity_type: activityType,
          description: description || null,
        } as any);
      if (logError) throw logError;

      // Upsert skill level
      const currentXp = levelQuery.data?.xp || 0;
      const newXp = currentXp + xpAmount;
      const newLevel = getLevelFromXp(newXp);

      if (levelQuery.data) {
        const { error } = await supabase
          .from('skill_levels' as any)
          .update({ xp: newXp, level: newLevel, updated_at: new Date().toISOString() } as any)
          .eq('id', levelQuery.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('skill_levels' as any)
          .insert({
            user_id: user.id,
            session_id: sessionId,
            xp: newXp,
            level: newLevel,
          } as any);
        if (error) throw error;
      }

      return { newXp, newLevel, previousLevel: levelQuery.data?.level || 1 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skill-level', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['skill-xp-log', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['skill-leaderboard', sessionId] });
    },
  });

  return {
    level: levelQuery.data,
    xpLog: xpLogQuery.data || [],
    leaderboard: leaderboardQuery.data || [],
    isLoading: levelQuery.isLoading,
    awardXp,
  };
}

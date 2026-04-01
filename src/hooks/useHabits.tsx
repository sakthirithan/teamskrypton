import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Habit {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  is_global: boolean;
  user_id: string | null;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface HabitCompletion {
  id: string;
  habit_id: string;
  user_id: string;
  completion_date: string;
  created_at: string;
}

export interface HabitRevokeRequest {
  id: string;
  habit_id: string;
  user_id: string;
  status: string;
  reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export function useHabits(sessionId?: string) {
  const { user, isLeadership } = useAuth();
  const { toast } = useToast();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [revokeRequests, setRevokeRequests] = useState<HabitRevokeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHabits = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const [habitsRes, completionsRes, revokeRes] = await Promise.all([
      supabase.from('habits').select('*').order('created_at', { ascending: false }),
      supabase.from('habit_completions').select('*'),
      supabase.from('habit_revoke_requests').select('*'),
    ]);

    if (habitsRes.data) {
      // Filter: show global habits + user's own personal habits
      const filtered = (habitsRes.data as unknown as Habit[]).filter(
        h => h.is_global || h.user_id === user.id
      );
      setHabits(filtered);
    }
    if (completionsRes.data) setCompletions(completionsRes.data as unknown as HabitCompletion[]);
    if (revokeRes.data) setRevokeRequests(revokeRes.data as unknown as HabitRevokeRequest[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchHabits(); }, [fetchHabits]);

  const createHabit = async (title: string, description: string, isGlobal: boolean) => {
    if (!user) return;
    const { error } = await supabase.from('habits').insert({
      title,
      description: description || null,
      is_global: isGlobal,
      user_id: isGlobal ? null : user.id,
      created_by: user.id,
      session_id: sessionId || null,
    } as any);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Habit created' });
      fetchHabits();
    }
  };

  const updateHabit = async (id: string, title: string, description: string) => {
    const { error } = await supabase.from('habits').update({ title, description } as any).eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Habit updated' });
      fetchHabits();
    }
  };

  const deleteHabit = async (id: string) => {
    const { error } = await supabase.from('habits').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Habit deleted' });
      fetchHabits();
    }
  };

  const toggleCompletion = async (habitId: string, date: string) => {
    if (!user) return;
    const existing = completions.find(
      c => c.habit_id === habitId && c.user_id === user.id && c.completion_date === date
    );
    if (existing) {
      await supabase.from('habit_completions').delete().eq('id', existing.id);
    } else {
      await supabase.from('habit_completions').insert({
        habit_id: habitId,
        user_id: user.id,
        completion_date: date,
      } as any);
    }
    fetchHabits();
  };

  const requestRevoke = async (habitId: string, reason: string) => {
    if (!user) return;
    const { error } = await supabase.from('habit_revoke_requests').insert({
      habit_id: habitId,
      user_id: user.id,
      reason,
    } as any);
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Revoke request submitted' });
      fetchHabits();
    }
  };

  const reviewRevoke = async (requestId: string, approved: boolean) => {
    if (!user) return;
    if (approved) {
      // Find the request to get habit_id and user_id
      const req = revokeRequests.find(r => r.id === requestId);
      if (req) {
        // Delete completions for this user+habit and mark approved
        await supabase.from('habit_revoke_requests').update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        } as any).eq('id', requestId);
      }
    } else {
      await supabase.from('habit_revoke_requests').update({
        status: 'rejected',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      } as any).eq('id', requestId);
    }
    toast({ title: approved ? 'Revoke approved' : 'Revoke rejected' });
    fetchHabits();
  };

  const getUserCompletions = (habitId: string, userId?: string) => {
    const uid = userId || user?.id;
    return completions.filter(c => c.habit_id === habitId && c.user_id === uid);
  };

  const getCompletionDates = (habitId: string, userId?: string): Set<string> => {
    return new Set(getUserCompletions(habitId, userId).map(c => c.completion_date));
  };

  const getStreak = (habitId: string, userId?: string): number => {
    const dates = getCompletionDates(habitId, userId);
    if (dates.size === 0) return 0;
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      if (dates.has(key)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  };

  return {
    habits,
    completions,
    revokeRequests,
    isLoading,
    createHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
    requestRevoke,
    reviewRevoke,
    getUserCompletions,
    getCompletionDates,
    getStreak,
    refetch: fetchHabits,
  };
}

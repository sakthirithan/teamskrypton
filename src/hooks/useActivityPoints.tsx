import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface ActivityPoint {
  id: string;
  user_id: string;
  session_id: string;
  points: number;
  reason: string | null;
  awarded_by: string;
  created_at: string;
}

export function useActivityPoints(sessionId?: string) {
  const { user, isLeadership } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: activityPoints = [], isLoading } = useQuery({
    queryKey: ['activity-points', sessionId],
    queryFn: async () => {
      let query = supabase
        .from('activity_points')
        .select('*')
        .order('created_at', { ascending: false });
      if (sessionId) query = query.eq('session_id', sessionId);
      const { data, error } = await query;
      if (error) throw error;
      return data as ActivityPoint[];
    },
    enabled: !!user,
  });

  // Aggregate points per user
  const getUserActivityTotal = (userId: string): number => {
    return activityPoints
      .filter(p => p.user_id === userId)
      .reduce((sum, p) => sum + p.points, 0);
  };

  const getLeaderboard = () => {
    const totals = new Map<string, number>();
    activityPoints.forEach(p => {
      totals.set(p.user_id, (totals.get(p.user_id) || 0) + p.points);
    });
    return Array.from(totals.entries())
      .map(([user_id, points]) => ({ user_id, points }))
      .sort((a, b) => b.points - a.points);
  };

  const awardPoints = useMutation({
    mutationFn: async ({ userId, points, reason, sessionId: sid }: { userId: string; points: number; reason?: string; sessionId: string }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('activity_points')
        .insert({ user_id: userId, session_id: sid, points, reason: reason || null, awarded_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-points'] });
      toast({ title: 'Activity Points Awarded' });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Failed', description: err.message });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('activity_points').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-points'] });
    },
  });

  return { activityPoints, isLoading, getUserActivityTotal, getLeaderboard, awardPoints, deleteEntry, isLeadership };
}

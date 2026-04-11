import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePblProjectLead } from '@/components/grouping/LeaderboardPanel';
import { useToast } from '@/hooks/use-toast';

export interface UserPoints {
  id: string;
  user_id: string;
  points: number;
  last_updated_by: string;
  last_updated_at: string;
  created_at: string;
  notes: string | null;
}

export interface PointsHistory {
  id: string;
  user_id: string;
  points_change: number;
  points_before: number;
  points_after: number;
  operation_type: 'add' | 'subtract' | 'set' | 'bonus' | 'penalty';
  reason: string | null;
  performed_by: string;
  created_at: string;
}

export type PointsOperation = 'add' | 'subtract' | 'set' | 'bonus' | 'penalty';

interface PointsOperationParams {
  userId: string;
  operation: PointsOperation;
  value: number;
  reason?: string;
}

export function useUserPoints() {
  const { user, role, isLeadership } = useAuth();
  const { data: isProjectLead } = usePblProjectLead(user?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const canManagePoints = isLeadership || isProjectLead;

  // Fetch all user points
  const { data: allPoints = [], isLoading: isLoadingPoints } = useQuery({
    queryKey: ['user-points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_points')
        .select('*')
        .order('points', { ascending: false });
      
      if (error) throw error;
      return data as UserPoints[];
    },
    enabled: !!user,
  });

  // Fetch points for a specific user
  const getUserPoints = (userId: string | undefined): number => {
    if (!userId) return 0;
    const userRecord = allPoints.find(p => p.user_id === userId);
    return userRecord?.points || 0;
  };

  // Fetch points history for a specific user
  const { data: pointsHistory = [], refetch: refetchHistory } = useQuery({
    queryKey: ['points-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as PointsHistory[];
    },
    enabled: !!user && canManagePoints,
  });

  // Get history for a specific user
  const getUserHistory = (userId: string): PointsHistory[] => {
    return pointsHistory.filter(h => h.user_id === userId);
  };

  // Perform points operation (TL only)
  const performOperation = useMutation({
    mutationFn: async ({ userId, operation, value, reason }: PointsOperationParams) => {
      if (!user) throw new Error('Not authenticated');
      
      // Get current points
      const { data: existingRecord } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const currentPoints = existingRecord?.points || 0;
      let newPoints: number;

      switch (operation) {
        case 'add':
        case 'bonus':
          newPoints = currentPoints + value;
          break;
        case 'subtract':
        case 'penalty':
          newPoints = Math.max(0, currentPoints - value);
          break;
        case 'set':
          newPoints = Math.max(0, value);
          break;
        default:
          throw new Error('Invalid operation');
      }

      // Upsert points record
      const { error: upsertError } = await supabase
        .from('user_points')
        .upsert({
          user_id: userId,
          points: newPoints,
          last_updated_by: user.id,
          last_updated_at: new Date().toISOString(),
          notes: reason || null,
        }, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;

      // Create history entry
      const { error: historyError } = await supabase
        .from('points_history')
        .insert({
          user_id: userId,
          points_change: operation === 'set' ? (newPoints - currentPoints) : 
                         (operation === 'add' || operation === 'bonus' ? value : -value),
          points_before: currentPoints,
          points_after: newPoints,
          operation_type: operation,
          reason: reason || null,
          performed_by: user.id,
        });

      if (historyError) throw historyError;

      return { userId, newPoints, previousPoints: currentPoints };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['points-history'] });
      
      const diff = data.newPoints - data.previousPoints;
      const diffText = diff >= 0 ? `+${diff}` : `${diff}`;
      
      toast({
        title: 'Points Updated',
        description: `${diffText} points (Now: ${data.newPoints})`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to update points',
        description: error.message,
      });
    },
  });

  // Bulk set initial points for all users
  const initializePoints = useMutation({
    mutationFn: async (userIds: string[]) => {
      if (!user) throw new Error('Not authenticated');
      
      const records = userIds.map(userId => ({
        user_id: userId,
        points: 0,
        last_updated_by: user.id,
        last_updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('user_points')
        .upsert(records, { onConflict: 'user_id', ignoreDuplicates: true });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
    },
  });

  return {
    allPoints,
    isLoadingPoints,
    getUserPoints,
    pointsHistory,
    getUserHistory,
    performOperation,
    initializePoints,
    canManagePoints,
    refetchHistory,
  };
}

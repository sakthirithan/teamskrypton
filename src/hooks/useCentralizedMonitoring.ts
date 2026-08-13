import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import {
  fetchAggregatedMonitoringData,
  updateMonitoringTarget,
  MemberMonitoringStatus,
  MonitoringTargetConfig,
} from '@/services/monitoringService';
import { useUserPoints } from '@/hooks/useUserPoints';

export function useCentralizedMonitoring(sessionId?: string | null) {
  const { user, role, isLeadership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { performOperation } = useUserPoints();

  const isLead =
    isLeadership ||
    role === 'team_captain' ||
    role === 'team_manager' ||
    role === 'strategist' ||
    role === 'admin';

  // Query aggregated monitoring data
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['centralized-monitoring', sessionId],
    queryFn: () => fetchAggregatedMonitoringData(sessionId),
    enabled: !!user,
    staleTime: 5000,
  });

  // Realtime subscription listeners for user_points, ps_daily_entries, daily_survey_responses, monitoring_targets
  useRealtimeSubscription({
    channelName: 'monitoring-user-points-rt',
    table: 'user_points',
    event: '*',
    enabled: !!user,
    onPayload: () => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring'] });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
    },
  });

  useRealtimeSubscription({
    channelName: 'monitoring-ps-entries-rt',
    table: 'ps_daily_entries',
    event: '*',
    enabled: !!user,
    onPayload: () => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring'] });
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
    },
  });

  useRealtimeSubscription({
    channelName: 'monitoring-targets-rt',
    table: 'monitoring_targets',
    event: '*',
    enabled: !!user,
    onPayload: () => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring'] });
    },
  });

  useRealtimeSubscription({
    channelName: 'monitoring-survey-rt',
    table: 'daily_survey_responses',
    event: '*',
    enabled: !!user,
    onPayload: () => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring'] });
    },
  });

  // Target update mutation
  const updateTargetMutation = useMutation({
    mutationFn: async ({
      targetType,
      requiredValue,
    }: {
      targetType: 'ap' | 'ps' | 'meeting' | 'survey';
      requiredValue: number;
    }) => {
      if (!isLead) throw new Error('Unauthorized target modification');
      await updateMonitoringTarget(targetType, requiredValue, sessionId, user?.id);
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring'] });
      toast({
        title: 'Target Updated',
        description: `Successfully set required ${vars.targetType.toUpperCase()} target to ${vars.requiredValue}.`,
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Target Update Failed',
        description: err.message,
      });
    },
  });

  // Manual AP set mutation for lead (updates user_points table)
  const setMemberApMutation = useMutation({
    mutationFn: async ({ userId, newApPoints }: { userId: string; newApPoints: number }) => {
      if (!isLead) throw new Error('Unauthorized AP points modification');
      return performOperation.mutateAsync({
        userId,
        operation: 'set',
        value: newApPoints,
        reason: 'Manual AP update by Authorized Lead in Centralized Monitoring',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring'] });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      toast({
        title: 'AP Points Updated',
        description: 'AP Points updated successfully across all dashboards.',
      });
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to update AP points',
        description: err.message,
      });
    },
  });

  return {
    targets: data?.targets || { apTarget: 4200, psTarget: 1, meetingTarget: 1, surveyTarget: 4 },
    members: data?.members || [],
    isLoading,
    isFetching,
    isLead,
    refetch,
    updateTarget: updateTargetMutation.mutateAsync,
    isUpdatingTarget: updateTargetMutation.isPending,
    setMemberAp: setMemberApMutation.mutateAsync,
    isSettingAp: setMemberApMutation.isPending,
  };
}

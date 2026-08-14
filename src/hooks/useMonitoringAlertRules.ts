import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type RuleCriterion = 'any' | 'missing_ap' | 'missing_ps' | 'missing_survey' | 'missing_meeting';
export type RuleRepeat = 'once' | 'daily' | 'weekdays';

export interface MonitoringAlertRule {
  id: string;
  name: string;
  criterion: RuleCriterion;
  run_at_time: string;
  repeat_mode: RuleRepeat;
  title: string;
  message: string;
  is_enabled: boolean;
  last_run_at: string | null;
  last_run_count: number;
  created_by: string | null;
  created_at: string;
}

export const CRITERION_LABELS: Record<RuleCriterion, string> = {
  any: 'Any requirement missing',
  missing_ap: 'Activity points missing',
  missing_ps: 'PS entry missing',
  missing_survey: 'Daily survey missing',
  missing_meeting: 'Group meeting missing',
};

export const REPEAT_LABELS: Record<RuleRepeat, string> = {
  once: 'Once only',
  daily: 'Every day',
  weekdays: 'Weekdays only',
};

export function useMonitoringAlertRules() {
  const { user, isLeadership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ['monitoring-alert-rules'],
    queryFn: async (): Promise<MonitoringAlertRule[]> => {
      const { data, error } = await supabase
        .from('monitoring_alert_rules')
        .select('*')
        .order('run_at_time', { ascending: true });
      if (error) throw error;
      return (data || []) as MonitoringAlertRule[];
    },
    enabled: !!user,
    staleTime: 20000,
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['monitoring-alert-rules'] });

  const showError = (title: string) => (err: any) =>
    toast({ variant: 'destructive', title, description: err?.message || 'Please try again.' });

  const createRule = useMutation({
    mutationFn: async (vars: {
      name: string;
      criterion: RuleCriterion;
      run_at_time: string;
      repeat_mode: RuleRepeat;
      title: string;
      message: string;
    }) => {
      if (!isLeadership) throw new Error('Only leadership can create automation rules');
      const { error } = await supabase.from('monitoring_alert_rules').insert({ ...vars, created_by: user!.id });
      if (error) throw error;
    },
    onError: showError('Could not create rule'),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Automation rule created' });
    },
  });

  const updateRule = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<MonitoringAlertRule> & { id: string }) => {
      if (!isLeadership) throw new Error('Only leadership can edit automation rules');
      const { error } = await supabase.from('monitoring_alert_rules').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, ...patch }) => {
      await queryClient.cancelQueries({ queryKey: ['monitoring-alert-rules'] });
      const previous = queryClient.getQueryData<MonitoringAlertRule[]>(['monitoring-alert-rules']);
      queryClient.setQueryData<MonitoringAlertRule[]>(['monitoring-alert-rules'], (old) =>
        (old || []).map((r) => (r.id === id ? { ...r, ...patch } : r))
      );
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['monitoring-alert-rules'], ctx.previous);
      showError('Could not update rule')(err);
    },
    onSuccess: () => invalidate(),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      if (!isLeadership) throw new Error('Only leadership can delete automation rules');
      const { error } = await supabase.from('monitoring_alert_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['monitoring-alert-rules'] });
      const previous = queryClient.getQueryData<MonitoringAlertRule[]>(['monitoring-alert-rules']);
      queryClient.setQueryData<MonitoringAlertRule[]>(['monitoring-alert-rules'], (old) =>
        (old || []).filter((r) => r.id !== id)
      );
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['monitoring-alert-rules'], ctx.previous);
      showError('Could not delete rule')(err);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Rule deleted' });
    },
  });

  return {
    rules: rulesQuery.data || [],
    isLoading: rulesQuery.isLoading,
    createRule,
    updateRule,
    deleteRule,
    isLeadership,
  };
}

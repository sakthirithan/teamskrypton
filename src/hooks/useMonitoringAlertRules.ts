import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type RuleCriterion = 'any' | 'missing_ap' | 'missing_ps' | 'missing_survey';
export type RuleRepeat = 'once' | 'daily' | 'weekdays' | 'custom';
export type RecipientType = 'all' | 'individual' | 'multiple';

export interface MonitoringAlertRule {
  id: string;
  name: string;
  criterion: RuleCriterion;
  recipient_type?: RecipientType;
  target_user_ids?: string[];
  selected_days?: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
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
  missing_ps: 'Minimum PS missing',
  missing_survey: 'Daily survey missing',
};

export const REPEAT_LABELS: Record<RuleRepeat, string> = {
  once: 'Once only',
  daily: 'Every day',
  weekdays: 'Weekdays only',
  custom: 'Custom Days',
};

export const WEEKDAY_OPTIONS = [
  { label: 'M', full: 'Monday', value: 1 },
  { label: 'T', full: 'Tuesday', value: 2 },
  { label: 'W', full: 'Wednesday', value: 3 },
  { label: 'Th', full: 'Thursday', value: 4 },
  { label: 'F', full: 'Friday', value: 5 },
  { label: 'S', full: 'Saturday', value: 6 },
  { label: 'Su', full: 'Sunday', value: 0 },
];

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

      return (data || []).map((r: any) => {
        let recipient_type: RecipientType = r.recipient_type || 'all';
        let target_user_ids: string[] = r.target_user_ids || [];
        let selected_days: number[] = r.selected_days || [1, 2, 3, 4, 5];
        let cleanMessage = r.message || '';

        // Fallback metadata parsing if columns are un-cached by PostgREST
        if (cleanMessage.startsWith('[Target:')) {
          const match = cleanMessage.match(/^\[Target:([^\]]+)\]\n?/);
          if (match) {
            const metaStr = match[1];
            cleanMessage = cleanMessage.replace(match[0], '');
            const parts = metaStr.split('|');
            if (parts[0]) recipient_type = parts[0] as RecipientType;
            parts.forEach((p) => {
              if (p.startsWith('Users:')) target_user_ids = p.replace('Users:', '').split(',').filter(Boolean);
              if (p.startsWith('Days:')) selected_days = p.replace('Days:', '').split(',').map(Number).filter((n) => !isNaN(n));
            });
          }
        }

        return {
          ...r,
          recipient_type,
          target_user_ids,
          selected_days,
          message: cleanMessage,
        };
      });
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
      recipient_type?: RecipientType;
      target_user_ids?: string[];
      selected_days?: number[];
      run_at_time: string;
      repeat_mode: RuleRepeat;
      title: string;
      message: string;
    }) => {
      if (!isLeadership) throw new Error('Only leadership can create automation rules');

      const recipientType = vars.recipient_type || 'all';
      const targetUserIds = vars.target_user_ids || [];
      const selectedDays = vars.selected_days || [1, 2, 3, 4, 5];

      // Primary attempt
      const primaryRes = await supabase.from('monitoring_alert_rules').insert({
        name: vars.name,
        criterion: vars.criterion,
        recipient_type: recipientType,
        target_user_ids: targetUserIds,
        selected_days: selectedDays,
        run_at_time: vars.run_at_time,
        repeat_mode: vars.repeat_mode,
        title: vars.title,
        message: vars.message,
        created_by: user!.id,
      } as any);

      if (!primaryRes.error) return;

      const errMessage = primaryRes.error.message || '';
      if (errMessage.includes('recipient_type') || errMessage.includes('selected_days') || primaryRes.error.code === 'PGRST204') {
        console.warn('[monitoring] Schema fallback for selected_days/recipient_type');
        const encodedMessage = `[Target:${recipientType}|Users:${targetUserIds.join(',')}|Days:${selectedDays.join(',')}]\n${vars.message}`;

        const fallbackRes = await supabase.from('monitoring_alert_rules').insert({
          name: vars.name,
          criterion: vars.criterion,
          run_at_time: vars.run_at_time,
          repeat_mode: vars.repeat_mode,
          title: vars.title,
          message: encodedMessage,
          created_by: user!.id,
        } as any);

        if (fallbackRes.error) throw fallbackRes.error;
      } else {
        throw primaryRes.error;
      }
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

      const primaryRes = await supabase.from('monitoring_alert_rules').update(patch as any).eq('id', id);
      if (!primaryRes.error) return;

      const errMessage = primaryRes.error.message || '';
      if (errMessage.includes('recipient_type') || errMessage.includes('selected_days') || primaryRes.error.code === 'PGRST204') {
        const { recipient_type, target_user_ids, selected_days, ...basePatch } = patch;
        const fallbackRes = await supabase.from('monitoring_alert_rules').update(basePatch as any).eq('id', id);
        if (fallbackRes.error) throw fallbackRes.error;
      } else {
        throw primaryRes.error;
      }
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

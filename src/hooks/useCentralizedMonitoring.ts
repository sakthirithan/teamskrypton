import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { KryptonRole } from '@/lib/roles';
import { resolveDeepLink } from '@/lib/deeplink';

export interface MonitoringTargets {
  id?: string;
  required_ap_target: number;
  required_ps_target: number;
  required_meeting_target: number;
  required_survey_target: number;
}

export interface IndividualMonitoringTarget {
  userId: string;
  required_ap_target?: number | null;
  required_ps_target?: number | null;
  required_meeting_target?: number | null;
  required_survey_target?: number | null;
}

export interface CriterionStatus {
  target: number;
  achieved: number;
  remaining: number;
  percentage: number;
  isMet: boolean;
  displayText: string;
}

export interface MemberMonitoringStatus {
  userId: string;
  fullName: string;
  email: string;
  department: string;
  avatarUrl: string | null;
  role: KryptonRole;
  ap: CriterionStatus;
  ps: CriterionStatus;
  groupMeeting: CriterionStatus;
  dailySurvey: CriterionStatus;
  hasPenalty: boolean;
  overallMet: boolean;
  lastUpdated: string;
  customTargets?: IndividualMonitoringTarget;
}

export interface ScheduledAlert {
  id: string;
  title: string;
  message: string;
  target_filter: string;
  target_user_ids?: string[];
  scheduled_at: string;
  status: string;
  created_by?: string | null;
  created_at: string;
}

export interface MonitoringAuditEntry {
  id: string;
  actor_id: string | null;
  target_user_id: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
}

const VIEW_MODE_KEY = 'krypton_monitoring_view_mode';

const DEFAULT_TARGETS: MonitoringTargets = {
  required_ap_target: 4200,
  required_ps_target: 1,
  required_meeting_target: 1,
  required_survey_target: 4,
};

export const today = () => new Date().toISOString().split('T')[0];

function buildCriterion(achieved: number, target: number, textFmt?: (a: number, t: number, met: boolean) => string): CriterionStatus {
  const remaining = Math.max(0, target - achieved);
  const isMet = achieved >= target;
  const percentage = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 100;
  return {
    target,
    achieved,
    remaining,
    percentage,
    isMet,
    displayText: textFmt ? textFmt(achieved, target, isMet) : `${achieved} / ${target}`,
  };
}

function recomputeOverall(m: MemberMonitoringStatus): MemberMonitoringStatus {
  return { ...m, overallMet: m.ap.isMet && m.ps.isMet && m.dailySurvey.isMet };
}

export function useCentralizedMonitoring() {
  const { user, isLeadership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewModeState] = useState<'compact' | 'grid' | 'detailed'>(
    () => (localStorage.getItem(VIEW_MODE_KEY) as any) || 'detailed'
  );

  const setViewMode = (mode: 'compact' | 'grid' | 'detailed') => {
    setViewModeState(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const fail = useCallback(
    (title: string) => (err: any) => {
      toast({ variant: 'destructive', title, description: err?.message || 'Please try again.' });
    },
    [toast]
  );

  const writeAudit = useCallback(
    async (entries: { target_user_id?: string | null; field: string; old_value?: string | null; new_value?: string | null; note?: string }[]) => {
      if (!user || entries.length === 0) return;
      try {
        await supabase.from('monitoring_audit_log').insert(
          entries.map((e) => ({
            actor_id: user.id,
            target_user_id: e.target_user_id ?? null,
            field: e.field,
            old_value: e.old_value ?? null,
            new_value: e.new_value ?? null,
            note: e.note ?? null,
          }))
        );
      } catch {
        /* audit failures must never block the primary action */
      }
    },
    [user]
  );

  /* ---------------------------------------------------------------- targets */

  const targetsQuery = useQuery({
    queryKey: ['monitoring-targets'],
    queryFn: async (): Promise<MonitoringTargets> => {
      const { data, error } = await supabase
        .from('monitoring_targets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return DEFAULT_TARGETS;
      return {
        id: data.id,
        required_ap_target: data.required_ap_target,
        required_ps_target: data.required_ps_target,
        required_meeting_target: data.required_meeting_target,
        required_survey_target: data.required_survey_target,
      };
    },
    enabled: !!user,
    staleTime: 30000,
    placeholderData: keepPreviousData,
  });

  const globalTargets = targetsQuery.data || DEFAULT_TARGETS;

  /* ------------------------------------------------------- monitoring board */

  const monitoringKey = ['centralized-monitoring-data', globalTargets] as const;

  const monitoringDataQuery = useQuery({
    queryKey: monitoringKey,
    queryFn: async (): Promise<MemberMonitoringStatus[]> => {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, department, avatar_url, updated_at')
        .or('is_disabled.is.null,is_disabled.eq.false')
        .order('full_name', { ascending: true });

      if (pErr) throw pErr;
      if (!profiles || profiles.length === 0) return [];

      const userIds = profiles.map((p) => p.user_id);
      const todayStr = today();

      const [rolesRes, apRes, psRes, surveyRes, meetingRes, indivRes] = await Promise.all([
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
        supabase.from('activity_points').select('user_id, points, updated_at').in('user_id', userIds),
        supabase
          .from('ps_daily_entries')
          .select('user_id, status, entry_date')
          .eq('status', 'completed')
          .eq('entry_date', todayStr)
          .in('user_id', userIds),
        supabase
          .from('daily_survey_responses')
          .select('user_id, response_count')
          .eq('survey_date', todayStr)
          .in('user_id', userIds),
        supabase
          .from('monitoring_meeting_records')
          .select('user_id, status')
          .eq('meeting_date', todayStr)
          .in('user_id', userIds),
        supabase.from('individual_monitoring_targets').select('*').in('user_id', userIds),
      ]);

      const firstError = [rolesRes, apRes, psRes, surveyRes, meetingRes, indivRes].find((r) => r.error)?.error;
      if (firstError) throw firstError;

      const rolesMap = new Map<string, KryptonRole>();
      (rolesRes.data || []).forEach((r) => rolesMap.set(r.user_id, r.role as KryptonRole));

      const apMap = new Map<string, { points: number; lastUpdated: string }>();
      (apRes.data || []).forEach((r) => {
        const existing = apMap.get(r.user_id) || { points: 0, lastUpdated: r.updated_at };
        apMap.set(r.user_id, {
          points: existing.points + (r.points || 0),
          lastUpdated: r.updated_at > existing.lastUpdated ? r.updated_at : existing.lastUpdated,
        });
      });

      const psCountMap = new Map<string, number>();
      (psRes.data || []).forEach((r) => psCountMap.set(r.user_id, (psCountMap.get(r.user_id) || 0) + 1));

      const surveyCountMap = new Map<string, number>();
      (surveyRes.data || []).forEach((r) => surveyCountMap.set(r.user_id, r.response_count || 0));

      const meetingCountMap = new Map<string, number>();
      (meetingRes.data || []).forEach((r) => {
        if (r.status === 'completed') meetingCountMap.set(r.user_id, 1);
      });

      const indivTargetsMap = new Map<string, IndividualMonitoringTarget>();
      (indivRes.data || []).forEach((r) => {
        indivTargetsMap.set(r.user_id, {
          userId: r.user_id,
          required_ap_target: r.required_ap_target,
          required_ps_target: r.required_ps_target,
          required_meeting_target: r.required_meeting_target,
          required_survey_target: r.required_survey_target,
        });
      });

      const results: MemberMonitoringStatus[] = profiles.map((p) => {
        const indivTarget = indivTargetsMap.get(p.user_id);
        const apData = apMap.get(p.user_id) || { points: 0, lastUpdated: p.updated_at };

        const apTarget = indivTarget?.required_ap_target ?? globalTargets.required_ap_target;
        const psTarget = indivTarget?.required_ps_target ?? globalTargets.required_ps_target;
        const meetingTarget = indivTarget?.required_meeting_target ?? globalTargets.required_meeting_target;
        const surveyTarget = indivTarget?.required_survey_target ?? globalTargets.required_survey_target;

        const ap = buildCriterion(apData.points, apTarget);
        const ps = buildCriterion(psCountMap.get(p.user_id) || 0, psTarget, (a, t, met) =>
          t === 1 ? (met ? 'Completed' : 'Pending') : `${a} / ${t}`
        );
        const groupMeeting = buildCriterion(meetingCountMap.get(p.user_id) || 0, meetingTarget, (a, t, met) =>
          t === 1 ? (met ? 'Attended' : 'Pending') : `${a} / ${t}`
        );
        const dailySurvey = buildCriterion(surveyCountMap.get(p.user_id) || 0, surveyTarget);

        return {
          userId: p.user_id,
          fullName: p.full_name,
          email: p.email,
          department: p.department,
          avatarUrl: p.avatar_url,
          role: rolesMap.get(p.user_id) || 'team_member',
          ap,
          ps,
          groupMeeting,
          dailySurvey,
          hasPenalty: false,
          overallMet: ap.isMet && ps.isMet && dailySurvey.isMet,
          lastUpdated: apData.lastUpdated || p.updated_at,
          customTargets: indivTarget,
        };
      });

      setLastSyncTime(new Date());
      return results;
    },
    enabled: !!user,
    staleTime: 15000,
    placeholderData: keepPreviousData,
  });

  const members = monitoringDataQuery.data || [];

  /** Optimistically patch a single member row in the cache. */
  const patchMember = useCallback(
    (userId: string, patch: (m: MemberMonitoringStatus) => MemberMonitoringStatus) => {
      const previous = queryClient.getQueryData<MemberMonitoringStatus[]>(monitoringKey);
      queryClient.setQueryData<MemberMonitoringStatus[]>(monitoringKey, (old) =>
        Array.isArray(old) ? old.map((m) => (m.userId === userId ? recomputeOverall(patch(m)) : m)) : old
      );
      return previous;
    },
    [queryClient, globalTargets]
  );

  const rollback = useCallback(
    (previous?: MemberMonitoringStatus[]) => {
      if (previous) queryClient.setQueryData(monitoringKey, previous);
    },
    [queryClient, globalTargets]
  );

  const invalidateBoard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
  }, [queryClient]);

  /* -------------------------------------------------------- scheduled alerts */

  const scheduledAlertsQuery = useQuery({
    queryKey: ['scheduled-monitoring-alerts'],
    queryFn: async (): Promise<ScheduledAlert[]> => {
      const { data, error } = await supabase
        .from('scheduled_monitoring_alerts')
        .select('*')
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return (data || []) as ScheduledAlert[];
    },
    enabled: !!user,
    staleTime: 15000,
    placeholderData: keepPreviousData,
  });

  /* ------------------------------------------------------------ audit / history */

  const auditQuery = useQuery({
    queryKey: ['monitoring-audit-log'],
    queryFn: async (): Promise<MonitoringAuditEntry[]> => {
      const { data, error } = await supabase
        .from('monitoring_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as MonitoringAuditEntry[];
    },
    enabled: !!user,
    staleTime: 20000,
    placeholderData: keepPreviousData,
  });

  /* ------------------------------------------------------- notification fanout */

  const dispatchNotifications = useCallback(
    async (opts: { userIds: string[]; title: string; message: string; type: string; path?: string; metadata?: Record<string, any> }) => {
      if (!user || opts.userIds.length === 0) return 0;
      const resolvedPath = resolveDeepLink(opts.path || '/grouping/monitoring');

      const rows = opts.userIds.map((uid) => ({
        sender_id: user.id,
        recipient_id: uid,
        title: opts.title,
        message: opts.message,
        type: opts.type,
        is_read: false,
        metadata: { actionable: true, path: resolvedPath, ...(opts.metadata || {}) },
      }));

      const { error } = await supabase.from('grouping_notifications').insert(rows as any);
      if (error) throw error;

      try {
        await supabase.functions.invoke('send-push', {
          body: {
            user_ids: opts.userIds,
            title: opts.title,
            body: opts.message,
            data: { type: opts.type, actionable: 'true', path: resolvedPath },
          },
        });
      } catch {
        /* push is best-effort */
      }
      return opts.userIds.length;
    },
    [user]
  );

  const resolveAudience = useCallback(
    (filter: string, explicitIds?: string[] | null) => {
      if (explicitIds && explicitIds.length > 0) return explicitIds;
      switch (filter) {
        case 'missing_survey':
          return members.filter((m) => !m.dailySurvey.isMet).map((m) => m.userId);
        case 'missing_ap':
          return members.filter((m) => !m.ap.isMet).map((m) => m.userId);
        case 'missing_ps':
          return members.filter((m) => !m.ps.isMet).map((m) => m.userId);
        case 'missing_meeting':
          return members.filter((m) => !m.groupMeeting.isMet).map((m) => m.userId);
        case 'missing_all':
        case 'any':
          return members.filter((m) => !m.overallMet).map((m) => m.userId);
        default:
          return members.map((m) => m.userId);
      }
    },
    [members]
  );

  /* ---------------------------------------------------------- dispatch worker */

  const processDueAlerts = useCallback(async () => {
    if (!user || !isLeadership) return;

    const alertsList = scheduledAlertsQuery.data || [];
    const due = alertsList.filter((a) => a.status === 'scheduled' && new Date(a.scheduled_at) <= new Date());
    let didWork = false;

    const formatPersonalizedBody = (recipientId: string, customNote?: string) => {
      const m = members.find((mem) => mem.userId === recipientId);
      const apVal = m ? `${m.ap.achieved} / ${m.ap.target}` : '0 / 0';
      const psVal = m?.ps.isMet ? 'Completed' : 'Not Yet';
      const surveyVal = m ? `${m.dailySurvey.achieved} / ${m.dailySurvey.target}` : '0 / 0';

      let cleanNote = (customNote || '').replace(/^\[Target:[^\]]+\]\n?/, '').trim();
      if (cleanNote) cleanNote = `${cleanNote}\n\n`;

      return `${cleanNote}Current Live Monitoring Status:\n\nAP: ${apVal}\nMinimum PS: ${psVal}\nDaily Survey: ${surveyVal}\n\nUpdate your record by submitting survey.`;
    };

    for (const alert of due) {
      const targetUserIds = resolveAudience(alert.target_filter, alert.target_user_ids);
      try {
        for (const recipientId of targetUserIds) {
          const body = formatPersonalizedBody(recipientId, alert.message);
          await dispatchNotifications({
            userIds: [recipientId],
            title: alert.title,
            message: body,
            type: 'daily_survey_alert',
            path: '/grouping/monitoring?open=survey',
            metadata: { scheduled_alert_id: alert.id, self_update: true },
          });
        }
        await supabase.from('scheduled_monitoring_alerts').update({ status: 'sent' }).eq('id', alert.id);
        didWork = true;
      } catch (err: any) {
        console.warn('[monitoring] scheduled alert dispatch failed', err?.message);
      }
    }

    // Recurring automation rules
    const { data: rules } = await supabase.from('monitoring_alert_rules').select('*').eq('is_enabled', true);
    const now = new Date();
    const todayStr = today();
    const dow = now.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

    for (const rule of rules || []) {
      if (!rule.is_enabled) continue;

      // Resolve active weekday schedule
      let ruleDays: number[] = (rule as any).selected_days || [];
      if (!ruleDays || ruleDays.length === 0) {
        if (rule.message && rule.message.includes('Days:')) {
          const match = rule.message.match(/Days:([0-9,]+)/);
          if (match) ruleDays = match[1].split(',').map(Number);
        }
      }
      if (!ruleDays || ruleDays.length === 0) {
        ruleDays = rule.repeat_mode === 'weekdays' ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
      }

      // Skip if current weekday is not in configured active days
      if (!ruleDays.includes(dow)) continue;

      const [hh, mm] = (rule.run_at_time || '18:00').split(':').map((n: string) => parseInt(n, 10));
      const runAt = new Date();
      runAt.setHours(hh || 0, mm || 0, 0, 0);
      if (now < runAt) continue;
      if (rule.last_run_at) {
        const last = new Date(rule.last_run_at);
        if (rule.repeat_mode === 'once') continue;
        if (last.toISOString().split('T')[0] === todayStr) continue;
      }

      const targetUserIds = resolveAudience(rule.criterion, (rule as any).target_user_ids);
      try {
        let sentCount = 0;
        for (const recipientId of targetUserIds) {
          const m = members.find((mem) => mem.userId === recipientId);
          // Suppress if member has already met the rule criterion
          if (rule.criterion === 'missing_survey' && m?.dailySurvey.isMet) continue;
          if (rule.criterion === 'missing_ap' && m?.ap.isMet) continue;
          if (rule.criterion === 'missing_ps' && m?.ps.isMet) continue;
          if ((rule.criterion === 'any' || rule.criterion === 'missing_all') && m?.overallMet) continue;

          const body = formatPersonalizedBody(recipientId, rule.message);

          await dispatchNotifications({
            userIds: [recipientId],
            title: rule.title, // Configured Automation Title
            message: body,
            type: 'monitoring_reminder',
            path: '/grouping/monitoring?open=survey',
            metadata: { rule_id: rule.id, self_update: true },
          });
          sentCount++;
        }

        await supabase
          .from('monitoring_alert_rules')
          .update({
            last_run_at: now.toISOString(),
            last_run_count: sentCount,
            is_enabled: rule.repeat_mode === 'once' ? false : rule.is_enabled,
          })
          .eq('id', rule.id);
        didWork = true;
      } catch (err: any) {
        console.warn('[monitoring] rule dispatch failed', err?.message);
      }
    }

    if (didWork) {
      queryClient.invalidateQueries({ queryKey: ['scheduled-monitoring-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-alert-rules'] });
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
    }
  }, [scheduledAlertsQuery.data, resolveAudience, dispatchNotifications, user, isLeadership, queryClient]);

  useEffect(() => {
    processDueAlerts();
    const interval = setInterval(processDueAlerts, 30000);
    return () => clearInterval(interval);
  }, [processDueAlerts]);

  /* ------------------------------------------------------------- realtime sync */

  const handleIncrementalRealtimeUpdate = useCallback(() => {
    setLastSyncTime(new Date());
    invalidateBoard();
  }, [invalidateBoard]);

  useRealtimeSubscription({ channelName: 'monitoring-ap-v7', table: 'activity_points', onPayload: handleIncrementalRealtimeUpdate });
  useRealtimeSubscription({ channelName: 'monitoring-ps-v7', table: 'ps_daily_entries', onPayload: handleIncrementalRealtimeUpdate });
  useRealtimeSubscription({ channelName: 'monitoring-survey-v7', table: 'daily_survey_responses', onPayload: handleIncrementalRealtimeUpdate });
  useRealtimeSubscription({ channelName: 'monitoring-meeting-v7', table: 'monitoring_meeting_records', onPayload: handleIncrementalRealtimeUpdate });
  useRealtimeSubscription({ channelName: 'monitoring-ind-targets-v7', table: 'individual_monitoring_targets', onPayload: handleIncrementalRealtimeUpdate });
  useRealtimeSubscription({
    channelName: 'monitoring-targets-v7',
    table: 'monitoring_targets',
    onPayload: () => queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] }),
  });
  useRealtimeSubscription({
    channelName: 'monitoring-sched-v7',
    table: 'scheduled_monitoring_alerts',
    onPayload: () => queryClient.invalidateQueries({ queryKey: ['scheduled-monitoring-alerts'] }),
  });
  useRealtimeSubscription({
    channelName: 'monitoring-rules-v7',
    table: 'monitoring_alert_rules',
    onPayload: () => queryClient.invalidateQueries({ queryKey: ['monitoring-alert-rules'] }),
  });
  useRealtimeSubscription({
    channelName: 'monitoring-audit-v7',
    table: 'monitoring_audit_log',
    onPayload: () => queryClient.invalidateQueries({ queryKey: ['monitoring-audit-log'] }),
  });

  /* ------------------------------------------------------------ target writes */

  const updateTargets = useMutation({
    mutationFn: async (changedTargets: Partial<MonitoringTargets>) => {
      if (!isLeadership) throw new Error('Only leadership can change team targets');

      const { data: existing, error: readErr } = await supabase
        .from('monitoring_targets')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (readErr) throw readErr;

      if (existing?.id) {
        const { error } = await supabase
          .from('monitoring_targets')
          .update({ ...changedTargets, updated_by: user!.id })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('monitoring_targets')
          .insert({ ...DEFAULT_TARGETS, ...changedTargets, updated_by: user!.id });
        if (error) throw error;
      }

      await writeAudit(
        Object.entries(changedTargets).map(([field, value]) => ({
          field: `team_target.${field}`,
          new_value: String(value),
          note: 'Team target updated',
        }))
      );
    },
    onMutate: async (newTargets) => {
      await queryClient.cancelQueries({ queryKey: ['monitoring-targets'] });
      const previous = queryClient.getQueryData<MonitoringTargets>(['monitoring-targets']);
      queryClient.setQueryData(['monitoring-targets'], (old: any) => ({ ...(old || DEFAULT_TARGETS), ...newTargets }));
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['monitoring-targets'], ctx.previous);
      fail('Failed to update targets')(err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
      invalidateBoard();
      queryClient.invalidateQueries({ queryKey: ['monitoring-audit-log'] });
      toast({ title: 'Team targets updated' });
    },
  });

  const updateIndividualTargets = useMutation({
    mutationFn: async (vars: {
      userId: string;
      required_ap_target?: number | null;
      required_ps_target?: number | null;
      required_meeting_target?: number | null;
      required_survey_target?: number | null;
    }) => {
      if (!isLeadership) throw new Error('Only leadership can change member targets');
      const { userId, ...fields } = vars;

      const payload: any = { user_id: userId, updated_by: user!.id };
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined) payload[k] = v;
      });

      const { error } = await supabase.from('individual_monitoring_targets').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;

      await writeAudit(
        Object.entries(fields)
          .filter(([, v]) => v !== undefined)
          .map(([field, value]) => ({
            target_user_id: userId,
            field: `member_target.${field}`,
            new_value: value === null ? 'team default' : String(value),
            note: 'Member target override',
          }))
      );
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['centralized-monitoring-data'] });
      const previous = patchMember(vars.userId, (m) => ({
        ...m,
        ap: vars.required_ap_target != null ? buildCriterion(m.ap.achieved, vars.required_ap_target) : m.ap,
        dailySurvey:
          vars.required_survey_target != null ? buildCriterion(m.dailySurvey.achieved, vars.required_survey_target) : m.dailySurvey,
      }));
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      rollback(ctx?.previous);
      fail('Failed to update member targets')(err);
    },
    onSuccess: () => {
      invalidateBoard();
      queryClient.invalidateQueries({ queryKey: ['monitoring-audit-log'] });
      toast({ title: 'Member targets saved' });
    },
  });

  /* -------------------------------------------------------------- AP mutation */

  const updateMemberAP = useMutation({
    mutationFn: async ({ userId, points, reason }: { userId: string; points: number; reason?: string }) => {
      if (!isLeadership) throw new Error('Only leadership can edit activity points');
      if (isNaN(points) || points < 0) throw new Error('Activity points must be a non-negative number');

      const { data: session } = await supabase.from('grouping_sessions').select('id').limit(1).maybeSingle();
      const { data: existingRows, error: readErr } = await supabase
        .from('activity_points')
        .select('id, points')
        .eq('user_id', userId);
      if (readErr) throw readErr;

      const previousTotal = (existingRows || []).reduce((s, r) => s + (r.points || 0), 0);

      if (existingRows && existingRows.length > 0) {
        const { error: updateErr } = await supabase
          .from('activity_points')
          .update({ points, reason: reason || 'Lead manual AP override', awarded_by: user!.id })
          .eq('id', existingRows[0].id);
        if (updateErr) throw updateErr;

        if (existingRows.length > 1) {
          const { error: delErr } = await supabase
            .from('activity_points')
            .delete()
            .in('id', existingRows.slice(1).map((r) => r.id));
          if (delErr) throw delErr;
        }
      } else {
        if (!session?.id) throw new Error('No grouping session found to attach points to');
        const { error: insertErr } = await supabase.from('activity_points').insert({
          user_id: userId,
          session_id: session.id,
          points,
          reason: reason || 'Lead manual AP override',
          awarded_by: user!.id,
        });
        if (insertErr) throw insertErr;
      }

      await writeAudit([
        { target_user_id: userId, field: 'activity_points', old_value: String(previousTotal), new_value: String(points), note: reason },
      ]);
    },
    onMutate: async ({ userId, points }) => {
      await queryClient.cancelQueries({ queryKey: ['centralized-monitoring-data'] });
      const previous = patchMember(userId, (m) => ({
        ...m,
        ap: buildCriterion(points, m.ap.target),
        lastUpdated: new Date().toISOString(),
      }));
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      rollback(ctx?.previous);
      fail('Failed to update activity points')(err);
    },
    onSuccess: () => {
      invalidateBoard();
      queryClient.invalidateQueries({ queryKey: ['activity-points'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['grouping-home-stats'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-audit-log'] });
      toast({ title: 'Activity points saved' });
    },
  });

  /* -------------------------------------------------------------- PS mutation */

  const applyPsStatus = async (userId: string, newStatus: 'completed' | 'pending', count = 1) => {
    const todayStr = today();

    if (newStatus === 'completed') {
      const { data: existing, error: exErr } = await supabase
        .from('ps_daily_entries')
        .select('id')
        .eq('user_id', userId)
        .eq('entry_date', todayStr);
      if (exErr) throw exErr;

      const existingCount = existing?.length || 0;
      if (existingCount < count) {
        const { data: activeSession } = await supabase
          .from('grouping_sessions')
          .select('id')
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();
        if (!activeSession?.id) throw new Error('No active session — start a session before recording PS entries');

        const newEntries = Array.from({ length: count - existingCount }).map((_, i) => ({
          s_no: existingCount + i + 1,
          session_id: activeSession.id,
          user_id: userId,
          entry_date: todayStr,
          skill_name: 'PS Requirement (Monitoring)',
          reward_points: 0,
          attempt_count: 1,
          entered_by: user!.id,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('ps_daily_entries').insert(newEntries as any);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ps_daily_entries')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('entry_date', todayStr);
        if (error) throw error;
      }
    } else {
      const { error } = await supabase
        .from('ps_daily_entries')
        .update({ status: 'pending', completed_at: null })
        .eq('user_id', userId)
        .eq('entry_date', todayStr);
      if (error) throw error;
    }
  };

  const setMemberPsStatus = useMutation({
    mutationFn: async ({ userId, newStatus, count = 1 }: { userId: string; newStatus: 'completed' | 'pending'; count?: number }) => {
      if (!isLeadership && userId !== user?.id) throw new Error('You can only update your own PS status');
      await applyPsStatus(userId, newStatus, count);
      await writeAudit([{ target_user_id: userId, field: 'ps_status', new_value: newStatus }]);
    },
    onMutate: async ({ userId, newStatus, count = 1 }) => {
      await queryClient.cancelQueries({ queryKey: ['centralized-monitoring-data'] });
      const previous = patchMember(userId, (m) => ({
        ...m,
        ps: buildCriterion(newStatus === 'completed' ? Math.max(count, m.ps.target) : 0, m.ps.target, (a, t, met) =>
          t === 1 ? (met ? 'Completed' : 'Pending') : `${a} / ${t}`
        ),
      }));
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      rollback(ctx?.previous);
      fail('Failed to update PS status')(err);
    },
    onSuccess: () => {
      invalidateBoard();
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-audit-log'] });
      toast({ title: 'PS status updated' });
    },
  });

  /* --------------------------------------------------------- meeting mutation */

  const setMemberMeetingStatus = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: 'completed' | 'pending' }) => {
      if (!isLeadership && userId !== user?.id) throw new Error('You can only update your own meeting status');
      const { error } = await supabase
        .from('monitoring_meeting_records')
        .upsert({ user_id: userId, meeting_date: today(), status, recorded_by: user!.id }, { onConflict: 'user_id,meeting_date' });
      if (error) throw error;
      await writeAudit([{ target_user_id: userId, field: 'group_meeting', new_value: status }]);
    },
    onMutate: async ({ userId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['centralized-monitoring-data'] });
      const previous = patchMember(userId, (m) => ({
        ...m,
        groupMeeting: buildCriterion(status === 'completed' ? m.groupMeeting.target : 0, m.groupMeeting.target, (a, t, met) =>
          t === 1 ? (met ? 'Attended' : 'Pending') : `${a} / ${t}`
        ),
      }));
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      rollback(ctx?.previous);
      fail('Failed to update meeting status')(err);
    },
    onSuccess: () => {
      invalidateBoard();
      queryClient.invalidateQueries({ queryKey: ['monitoring-audit-log'] });
      toast({ title: 'Meeting status updated' });
    },
  });

  /* ---------------------------------------------------------- survey mutations */

  const upsertSurveyCount = async (userId: string, count: number, source: string, answers?: Record<string, any>) => {
    const { error } = await supabase.from('daily_survey_responses').upsert(
      {
        user_id: userId,
        survey_date: today(),
        response_count: Math.max(0, count),
        answers: { source, ...(answers || {}) },
        submitted_by: user!.id,
      },
      { onConflict: 'user_id,survey_date' }
    );
    if (error) throw error;
  };

  const setMemberSurveyCount = useMutation({
    mutationFn: async ({ userId, count }: { userId: string; count: number }) => {
      if (!isLeadership && userId !== user?.id) throw new Error('You can only update your own survey count');
      await upsertSurveyCount(userId, count, isLeadership ? 'lead_override' : 'self_update');
      await writeAudit([{ target_user_id: userId, field: 'daily_survey', new_value: String(count) }]);
    },
    onMutate: async ({ userId, count }) => {
      await queryClient.cancelQueries({ queryKey: ['centralized-monitoring-data'] });
      const previous = patchMember(userId, (m) => ({ ...m, dailySurvey: buildCriterion(count, m.dailySurvey.target) }));
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      rollback(ctx?.previous);
      fail('Failed to update survey count')(err);
    },
    onSuccess: () => {
      invalidateBoard();
      queryClient.invalidateQueries({ queryKey: ['monitoring-audit-log'] });
      toast({ title: 'Survey count updated' });
    },
  });

  const submitDailySurvey = useMutation({
    mutationFn: async (vars: {
      psStatus?: 'completed' | 'pending';
      surveyCount?: number;
      answers?: Record<string, any>;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const me = members.find((m) => m.userId === user.id);

      if (vars.psStatus !== undefined) {
        await applyPsStatus(user.id, vars.psStatus, 1);
      }

      const count = vars.surveyCount !== undefined
        ? vars.surveyCount
        : Math.min(me?.dailySurvey.target ?? 4, (me?.dailySurvey.achieved ?? 0) + 1);

      await upsertSurveyCount(user.id, count, 'self_survey_form', vars.answers);

      await writeAudit([
        {
          target_user_id: user.id,
          field: 'take_survey_submission',
          new_value: JSON.stringify({ psStatus: vars.psStatus, surveyCount: count }),
          note: 'Submitted via Take Survey form',
        },
      ]);
    },
    onMutate: async (vars) => {
      if (!user) return {};
      await queryClient.cancelQueries({ queryKey: ['centralized-monitoring-data'] });
      const previous = patchMember(user.id, (m) => ({
        ...m,
        ps: vars.psStatus !== undefined
          ? buildCriterion(vars.psStatus === 'completed' ? m.ps.target : 0, m.ps.target, (a, t, met) =>
              t === 1 ? (met ? 'Completed' : 'Pending') : `${a} / ${t}`
            )
          : m.ps,
        dailySurvey: buildCriterion(
          vars.surveyCount !== undefined
            ? vars.surveyCount
            : Math.min(m.dailySurvey.target, m.dailySurvey.achieved + 1),
          m.dailySurvey.target
        ),
      }));
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      rollback(ctx?.previous);
      fail('Failed to submit survey')(err);
    },
    onSuccess: () => {
      invalidateBoard();
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-audit-log'] });
      toast({ title: 'Daily survey & PS status recorded' });
    },
  });

  /* ------------------------------------- self-service update from notifications */

  const selfUpdateStatus = useMutation({
    mutationFn: async (vars: {
      alertId?: string;
      surveyCount?: number;
      psDone?: boolean;
      meetingDone?: boolean;
      apPoints?: number;
    }) => {
      if (!user) throw new Error('Not authenticated');

      if (vars.surveyCount !== undefined) {
        await upsertSurveyCount(user.id, vars.surveyCount, 'self_update_notification');
      }
      if (vars.psDone !== undefined) {
        await applyPsStatus(user.id, vars.psDone ? 'completed' : 'pending', 1);
      }
      if (vars.meetingDone !== undefined) {
        const { error } = await supabase.from('monitoring_meeting_records').upsert(
          { user_id: user.id, meeting_date: today(), status: vars.meetingDone ? 'completed' : 'pending', recorded_by: user.id },
          { onConflict: 'user_id,meeting_date' }
        );
        if (error) throw error;
      }
      if (vars.apPoints !== undefined && isLeadership) {
        await updateMemberAP.mutateAsync({ userId: user.id, points: vars.apPoints });
      }

      if (vars.alertId) {
        await supabase.from('grouping_notifications').update({ is_read: true }).eq('id', vars.alertId);
      }

      await writeAudit([
        {
          target_user_id: user.id,
          field: 'self_update',
          new_value: JSON.stringify({
            survey: vars.surveyCount,
            ps: vars.psDone,
            meeting: vars.meetingDone,
          }),
          note: 'Updated from actionable notification',
        },
      ]);
    },
    onMutate: async (vars) => {
      if (!user) return {};
      await queryClient.cancelQueries({ queryKey: ['centralized-monitoring-data'] });
      const previous = patchMember(user.id, (m) => ({
        ...m,
        dailySurvey: vars.surveyCount !== undefined ? buildCriterion(vars.surveyCount, m.dailySurvey.target) : m.dailySurvey,
        ps:
          vars.psDone !== undefined
            ? buildCriterion(vars.psDone ? m.ps.target : 0, m.ps.target, (a, t, met) =>
                t === 1 ? (met ? 'Completed' : 'Pending') : `${a} / ${t}`
              )
            : m.ps,
        groupMeeting:
          vars.meetingDone !== undefined
            ? buildCriterion(vars.meetingDone ? m.groupMeeting.target : 0, m.groupMeeting.target, (a, t, met) =>
                t === 1 ? (met ? 'Attended' : 'Pending') : `${a} / ${t}`
              )
            : m.groupMeeting,
      }));
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      rollback(ctx?.previous);
      fail('Could not save your update')(err);
    },
    onSuccess: () => {
      invalidateBoard();
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
      toast({ title: 'Your status is updated' });
    },
  });

  /** Legacy quick-response used by notification panels: [Completed] / [Not Yet]. */
  const handleActionableResponse = useMutation({
    mutationFn: async ({ alertId, action }: { alertId?: string; action: 'completed' | 'not_yet' }) => {
      if (!user) throw new Error('Not authenticated');

      if (action === 'completed') {
        const me = members.find((m) => m.userId === user.id);
        const next = Math.min(me?.dailySurvey.target ?? 4, (me?.dailySurvey.achieved ?? 0) + 1);
        await upsertSurveyCount(user.id, next, 'actionable_completed');
      }

      if (alertId) {
        await supabase.from('grouping_notifications').update({ is_read: true }).eq('id', alertId);
      }
    },
    onMutate: async ({ action }) => {
      if (!user || action !== 'completed') return {};
      await queryClient.cancelQueries({ queryKey: ['centralized-monitoring-data'] });
      const previous = patchMember(user.id, (m) => ({
        ...m,
        dailySurvey: buildCriterion(Math.min(m.dailySurvey.target, m.dailySurvey.achieved + 1), m.dailySurvey.target),
      }));
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      rollback(ctx?.previous);
      fail('Could not record your response')(err);
    },
    onSuccess: (_d, vars) => {
      invalidateBoard();
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
      if (vars.action === 'completed') toast({ title: 'Survey response recorded' });
    },
  });

  /* --------------------------------------------------------------- bulk update */

  const bulkUpdateMembers = useMutation({
    mutationFn: async ({ userIds, field, value }: { userIds: string[]; field: 'ap' | 'ps' | 'meeting' | 'survey'; value: any }) => {
      if (!isLeadership) throw new Error('Only leadership can run bulk updates');
      if (userIds.length === 0) throw new Error('No members selected');

      if (field === 'ap') {
        const delta = typeof value === 'number' ? value : parseInt(value, 10);
        const { data: session } = await supabase.from('grouping_sessions').select('id').limit(1).maybeSingle();
        for (const uid of userIds) {
          const { data: existing } = await supabase.from('activity_points').select('id, points').eq('user_id', uid).limit(1).maybeSingle();
          if (existing?.id) {
            const { error } = await supabase
              .from('activity_points')
              .update({ points: (existing.points || 0) + delta })
              .eq('id', existing.id);
            if (error) throw error;
          } else {
            if (!session?.id) throw new Error('No grouping session found to attach points to');
            const { error } = await supabase.from('activity_points').insert({
              user_id: uid,
              session_id: session.id,
              points: delta,
              reason: 'Bulk AP update',
              awarded_by: user!.id,
            });
            if (error) throw error;
          }
        }
      } else if (field === 'ps') {
        for (const uid of userIds) await applyPsStatus(uid, value as 'completed' | 'pending', 1);
      } else if (field === 'meeting') {
        const { error } = await supabase.from('monitoring_meeting_records').upsert(
          userIds.map((uid) => ({ user_id: uid, meeting_date: today(), status: value as string, recorded_by: user!.id })),
          { onConflict: 'user_id,meeting_date' }
        );
        if (error) throw error;
      } else if (field === 'survey') {
        const count = typeof value === 'number' ? value : parseInt(value, 10);
        const { error } = await supabase.from('daily_survey_responses').upsert(
          userIds.map((uid) => ({
            user_id: uid,
            survey_date: today(),
            response_count: Math.max(0, count),
            answers: { source: 'bulk_lead_override' },
            submitted_by: user!.id,
          })),
          { onConflict: 'user_id,survey_date' }
        );
        if (error) throw error;
      }

      await writeAudit(userIds.map((uid) => ({ target_user_id: uid, field: `bulk.${field}`, new_value: String(value) })));
    },
    onError: (err: any) => {
      invalidateBoard();
      fail('Bulk update failed')(err);
    },
    onSuccess: (_d, vars) => {
      invalidateBoard();
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      queryClient.invalidateQueries({ queryKey: ['monitoring-audit-log'] });
      toast({ title: 'Bulk update applied', description: `${vars.userIds.length} member(s) updated.` });
    },
  });

  /* ------------------------------------------------------------ alert mutations */

  const createScheduledAlert = useMutation({
    mutationFn: async (vars: {
      title: string;
      message: string;
      target_filter: string;
      target_user_ids?: string[];
      scheduled_at: string;
    }) => {
      if (!isLeadership) throw new Error('Only leadership can schedule alerts');
      const { error } = await supabase.from('scheduled_monitoring_alerts').insert({
        title: vars.title,
        message: vars.message,
        target_filter: vars.target_filter,
        target_user_ids: vars.target_user_ids || [],
        scheduled_at: vars.scheduled_at,
        status: 'scheduled',
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onError: fail('Failed to schedule alert'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-monitoring-alerts'] });
      toast({ title: 'Alert scheduled' });
    },
  });

  const cancelScheduledAlert = useMutation({
    mutationFn: async (alertId: string) => {
      if (!isLeadership) throw new Error('Only leadership can cancel alerts');
      const { error } = await supabase.from('scheduled_monitoring_alerts').update({ status: 'cancelled' }).eq('id', alertId);
      if (error) throw error;
    },
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: ['scheduled-monitoring-alerts'] });
      const previous = queryClient.getQueryData<ScheduledAlert[]>(['scheduled-monitoring-alerts']);
      queryClient.setQueryData<ScheduledAlert[]>(['scheduled-monitoring-alerts'], (old) =>
        (old || []).map((a) => (a.id === alertId ? { ...a, status: 'cancelled' } : a))
      );
      return { previous };
    },
    onError: (err: any, _v, ctx: any) => {
      if (ctx?.previous) queryClient.setQueryData(['scheduled-monitoring-alerts'], ctx.previous);
      fail('Failed to cancel alert')(err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-monitoring-alerts'] });
      toast({ title: 'Scheduled alert cancelled' });
    },
  });

  const sendDailySurveyActionablePrompt = useMutation({
    mutationFn: async (targetUserId?: string) => {
      if (!user) throw new Error('Not authenticated');
      const recipientId = targetUserId || user.id;
      const member = members.find((m) => m.userId === recipientId);

      const apStatus = member ? `${member.ap.achieved} / ${member.ap.target}` : '0 / 0';
      const psStatus = member?.ps.isMet ? 'Completed' : 'Not Yet';
      const surveyStatus = member ? `${member.dailySurvey.achieved} / ${member.dailySurvey.target}` : '0 / 0';

      await dispatchNotifications({
        userIds: [recipientId],
        title: 'Complete your daily targets, then take the Daily Survey',
        message: `Member: ${member?.fullName || 'User'}\nActivity Points: ${apStatus}\nMinimum PS: ${psStatus}\nDaily Survey: ${surveyStatus}\n\nPlease complete your remaining requirements.`,
        type: 'daily_survey_alert',
        path: '/grouping/monitoring?open=survey',
        metadata: { ap_status: apStatus, ps_status: psStatus, survey_status: surveyStatus, self_update: true },
      });
    },
    onError: fail('Failed to send prompt'),
    onSuccess: () => toast({ title: 'Survey prompt sent' }),
  });

  const sendLeadAlert = useMutation({
    mutationFn: async (vars: {
      recipientIds: string[];
      title: string;
      messagePrefix?: string;
      alertType: string;
      onlyIncomplete?: boolean;
      expiryHours?: number;
    }) => {
      if (!isLeadership) throw new Error('Only leadership can send alerts');
      const onlyIncomplete = vars.onlyIncomplete ?? true;

      const recipients = vars.recipientIds.filter((uid) => {
        const m = members.find((mem) => mem.userId === uid);
        if (!m) return false;
        return onlyIncomplete ? !m.overallMet : true;
      });

      if (recipients.length === 0) throw new Error('Everyone selected has already completed their requirements');

      const expHours = vars.expiryHours === 48 ? 48 : 24;
      const expiresAtIso = new Date(Date.now() + expHours * 60 * 60 * 1000).toISOString();
      const resolvedPath = resolveDeepLink('/grouping/monitoring?open=survey');

      const rows = recipients.map((uid) => {
        const member = members.find((m) => m.userId === uid)!;
        const statusSummary = `Member: ${member.fullName}\nActivity Points: ${member.ap.achieved} / ${member.ap.target}\nMinimum PS: ${member.ps.isMet ? 'Completed' : 'Not Yet'}\nDaily Survey: ${member.dailySurvey.achieved} / ${member.dailySurvey.target}`;

        const fullMsg = vars.messagePrefix
          ? `${vars.messagePrefix}\n\n${statusSummary}`
          : `Monitoring Update\n\n${statusSummary}\n\nPlease update your requirements using Take Survey.`;

        return {
          sender_id: user!.id,
          recipient_id: uid,
          title: vars.title,
          message: fullMsg,
          type: vars.alertType,
          is_read: false,
          expires_at: expiresAtIso,
          metadata: {
            actionable: true,
            self_update: true,
            path: resolvedPath,
            ap_status: `${member.ap.achieved} / ${member.ap.target}`,
            ps_status: member.ps.isMet ? 'Completed' : 'Not Yet',
            survey_status: `${member.dailySurvey.achieved} / ${member.dailySurvey.target}`,
            expiry_hours: expHours,
          },
        };
      });

      const { error } = await supabase.from('grouping_notifications').insert(rows as any);
      if (error) throw error;

      try {
        await supabase.functions.invoke('send-push', {
          body: {
            user_ids: recipients,
            title: `⚠️ ${vars.title}`,
            body: vars.messagePrefix || 'You have pending requirements.',
            data: { type: vars.alertType, actionable: 'true', path: resolvedPath },
          },
        });
      } catch {
        /* push best-effort */
      }

      return recipients.length;
    },
    onError: fail('Alert not sent'),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
      toast({ title: 'Alert dispatched', description: `Sent to ${count} member(s).` });
    },
  });

  return {
    targets: globalTargets,
    membersMonitoring: members,
    scheduledAlerts: scheduledAlertsQuery.data || [],
    auditLog: auditQuery.data || [],
    isLoading: monitoringDataQuery.isLoading || targetsQuery.isLoading,
    isFetching: monitoringDataQuery.isFetching,
    error: (monitoringDataQuery.error || targetsQuery.error) as Error | null,
    viewMode,
    setViewMode,
    lastSyncTime,
    updateTargets,
    updateIndividualTargets,
    sendDailySurveyActionablePrompt,
    bulkUpdateMembers,
    createScheduledAlert,
    cancelScheduledAlert,
    updateMemberAP,
    setMemberPsStatus,
    setMemberMeetingStatus,
    setMemberSurveyCount,
    submitDailySurvey,
    selfUpdateStatus,
    handleActionableResponse,
    sendLeadAlert,
    isLeadership,
    user,
    refetch: monitoringDataQuery.refetch,
  };
}

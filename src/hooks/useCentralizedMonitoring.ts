import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  status: 'scheduled' | 'sent' | 'cancelled';
  idempotent_key?: string;
  created_by?: string;
  created_at: string;
}

const STORAGE_KEYS = {
  TARGETS: 'krypton_monitoring_global_targets',
  INDIVIDUAL_TARGETS: 'krypton_monitoring_individual_targets',
  SURVEY_RESPONSES: 'krypton_daily_survey_responses',
  MEETING_RECORDS: 'krypton_monitoring_meeting_records',
  SCHEDULED_ALERTS: 'krypton_scheduled_alerts',
  VIEW_MODE: 'krypton_monitoring_view_mode',
};

function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error === 'string' ? error : error.message || error.details || '';
  const code = error.code || '';
  return code === 'PGRST205' || code === '42P01' || msg.toLowerCase().includes('schema cache') || msg.toLowerCase().includes('could not find the table');
}

export function useCentralizedMonitoring() {
  const { user, role, isLeadership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [viewMode, setViewModeState] = useState<'compact' | 'grid' | 'detailed'>(() => {
    return (localStorage.getItem(STORAGE_KEYS.VIEW_MODE) as any) || 'detailed';
  });

  const setViewMode = (mode: 'compact' | 'grid' | 'detailed') => {
    setViewModeState(mode);
    localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode);
  };

  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  // 1. Fetch Global Targets
  const targetsQuery = useQuery({
    queryKey: ['monitoring-targets'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('monitoring_targets' as any)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && isMissingTableError(error)) {
          const cached = localStorage.getItem(STORAGE_KEYS.TARGETS);
          return cached ? JSON.parse(cached) : { required_ap_target: 4200, required_ps_target: 1, required_meeting_target: 1, required_survey_target: 4 };
        }

        if (data) {
          localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(data));
          return data as MonitoringTargets;
        }
      } catch {
        console.warn('[monitoring] Using local targets fallback');
      }

      const cached = localStorage.getItem(STORAGE_KEYS.TARGETS);
      return (cached ? JSON.parse(cached) : {
        required_ap_target: 4200,
        required_ps_target: 1,
        required_meeting_target: 1,
        required_survey_target: 4,
      }) as MonitoringTargets;
    },
    enabled: !!user,
    staleTime: 10000,
  });

  const globalTargets = targetsQuery.data || {
    required_ap_target: 4200,
    required_ps_target: 1,
    required_meeting_target: 1,
    required_survey_target: 4,
  };

  // 2. Fetch Aggregated Monitoring Data
  const monitoringDataQuery = useQuery({
    queryKey: ['centralized-monitoring-data', globalTargets],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, department, avatar_url, updated_at')
        .or('is_disabled.is.null,is_disabled.eq.false')
        .order('full_name', { ascending: true });

      if (pErr) throw pErr;
      if (!profiles || profiles.length === 0) return [];

      const userIds = profiles.map((p) => p.user_id);
      const todayStr = new Date().toISOString().split('T')[0];

      const [rolesRes, apRes, psRes] = await Promise.all([
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
        supabase.from('activity_points').select('user_id, points, updated_at').in('user_id', userIds),
        supabase.from('ps_daily_entries').select('user_id, status, entry_date').eq('status', 'completed').in('user_id', userIds),
      ]);

      let surveyData: any[] = [];
      try {
        const res = await supabase.from('daily_survey_responses' as any).select('*').in('user_id', userIds);
        if (res.error && isMissingTableError(res.error)) {
          const cached = localStorage.getItem(STORAGE_KEYS.SURVEY_RESPONSES);
          surveyData = cached ? JSON.parse(cached) : [];
        } else {
          surveyData = res.data || [];
        }
      } catch {
        const cached = localStorage.getItem(STORAGE_KEYS.SURVEY_RESPONSES);
        surveyData = cached ? JSON.parse(cached) : [];
      }

      let meetingData: any[] = [];
      try {
        const res = await supabase.from('monitoring_meeting_records' as any).select('user_id, status, meeting_date').in('user_id', userIds);
        if (res.error && isMissingTableError(res.error)) {
          const cached = localStorage.getItem(STORAGE_KEYS.MEETING_RECORDS);
          meetingData = cached ? JSON.parse(cached) : [];
        } else {
          meetingData = res.data || [];
        }
      } catch {
        const cached = localStorage.getItem(STORAGE_KEYS.MEETING_RECORDS);
        meetingData = cached ? JSON.parse(cached) : [];
      }

      let indivTargetsData: any[] = [];
      try {
        const res = await supabase.from('individual_monitoring_targets' as any).select('*').in('user_id', userIds);
        if (res.error && isMissingTableError(res.error)) {
          const cached = localStorage.getItem(STORAGE_KEYS.INDIVIDUAL_TARGETS);
          indivTargetsData = cached ? JSON.parse(cached) : [];
        } else {
          indivTargetsData = res.data || [];
        }
      } catch {
        const cached = localStorage.getItem(STORAGE_KEYS.INDIVIDUAL_TARGETS);
        indivTargetsData = cached ? JSON.parse(cached) : [];
      }

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

      // PS Entries for Today
      const psCountMap = new Map<string, number>();
      (psRes.data || []).forEach((r) => {
        if (r.entry_date === todayStr || !r.entry_date) {
          psCountMap.set(r.user_id, (psCountMap.get(r.user_id) || 0) + 1);
        }
      });

      // Daily Survey Count Calculation from Source of Truth
      const surveyCountMap = new Map<string, number>();
      surveyData.forEach((r: any) => {
        if (r.survey_date === todayStr || !r.survey_date) {
          const countVal = typeof r.answers?.response_count === 'number' ? r.answers.response_count : 1;
          surveyCountMap.set(r.user_id, (surveyCountMap.get(r.user_id) || 0) + countVal);
        }
      });

      // Meeting Count
      const meetingCountMap = new Map<string, number>();
      meetingData.forEach((r: any) => {
        if ((r.meeting_date === todayStr || !r.meeting_date) && r.status === 'completed') {
          meetingCountMap.set(r.user_id, (meetingCountMap.get(r.user_id) || 0) + 1);
        }
      });

      const indivTargetsMap = new Map<string, IndividualMonitoringTarget>();
      indivTargetsData.forEach((r: any) => {
        indivTargetsMap.set(r.user_id, {
          userId: r.user_id,
          required_ap_target: r.required_ap_target,
          required_ps_target: r.required_ps_target,
          required_meeting_target: r.required_meeting_target,
          required_survey_target: r.required_survey_target,
        });
      });

      const results: MemberMonitoringStatus[] = profiles.map((p) => {
        const userRole = rolesMap.get(p.user_id) || 'team_member';
        const apData = apMap.get(p.user_id) || { points: 0, lastUpdated: p.updated_at };
        const indivTarget = indivTargetsMap.get(p.user_id);

        const apTarget = indivTarget?.required_ap_target ?? globalTargets.required_ap_target;
        const psTarget = indivTarget?.required_ps_target ?? globalTargets.required_ps_target;
        const meetingTarget = indivTarget?.required_meeting_target ?? globalTargets.required_meeting_target;
        const surveyTarget = indivTarget?.required_survey_target ?? globalTargets.required_survey_target;

        const apAchieved = apData.points;
        const apRem = Math.max(0, apTarget - apAchieved);
        const apMet = apAchieved >= apTarget;
        const apPct = apTarget > 0 ? Math.min(100, Math.round((apAchieved / apTarget) * 100)) : 100;

        const psAchieved = psCountMap.get(p.user_id) || 0;
        const psRem = Math.max(0, psTarget - psAchieved);
        const psMet = psAchieved >= psTarget;
        const psPct = psTarget > 0 ? Math.min(100, Math.round((psAchieved / psTarget) * 100)) : 100;
        const psText = psTarget === 1 ? (psMet ? 'Completed' : 'Pending') : `${psAchieved} / ${psTarget}`;

        const meetingAchieved = meetingCountMap.get(p.user_id) || 1;
        const meetingRem = Math.max(0, meetingTarget - meetingAchieved);
        const meetingMet = meetingAchieved >= meetingTarget;
        const meetingPct = meetingTarget > 0 ? Math.min(100, Math.round((meetingAchieved / meetingTarget) * 100)) : 100;

        const surveyAchieved = surveyCountMap.get(p.user_id) || 0;
        const surveyRem = Math.max(0, surveyTarget - surveyAchieved);
        const surveyMet = surveyAchieved >= surveyTarget;
        const surveyPct = surveyTarget > 0 ? Math.min(100, Math.round((surveyAchieved / surveyTarget) * 100)) : 100;

        const overallMet = apMet && psMet && meetingMet && surveyMet;

        return {
          userId: p.user_id,
          fullName: p.full_name,
          email: p.email,
          department: p.department,
          avatarUrl: p.avatar_url,
          role: userRole,
          ap: {
            target: apTarget,
            achieved: apAchieved,
            remaining: apRem,
            percentage: apPct,
            isMet: apMet,
            displayText: `${apAchieved} / ${apTarget}`,
          },
          ps: {
            target: psTarget,
            achieved: psAchieved,
            remaining: psRem,
            percentage: psPct,
            isMet: psMet,
            displayText: psText,
          },
          groupMeeting: {
            target: meetingTarget,
            achieved: meetingAchieved,
            remaining: meetingRem,
            percentage: meetingPct,
            isMet: meetingMet,
            displayText: `${meetingAchieved} / ${meetingTarget}`,
          },
          dailySurvey: {
            target: surveyTarget,
            achieved: surveyAchieved,
            remaining: surveyRem,
            percentage: surveyPct,
            isMet: surveyMet,
            displayText: `${surveyAchieved} / ${surveyTarget}`,
          },
          hasPenalty: false,
          overallMet,
          lastUpdated: apData.lastUpdated || p.updated_at,
          customTargets: indivTarget,
        };
      });

      setLastSyncTime(new Date());
      return results;
    },
    enabled: !!user,
    staleTime: 10000,
  });

  // Scheduled Alerts Query
  const scheduledAlertsQuery = useQuery({
    queryKey: ['scheduled-monitoring-alerts'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('scheduled_monitoring_alerts' as any)
          .select('*')
          .order('scheduled_at', { ascending: true });

        if (error && isMissingTableError(error)) {
          const cached = localStorage.getItem(STORAGE_KEYS.SCHEDULED_ALERTS);
          return cached ? JSON.parse(cached) : [];
        }
        if (data) {
          localStorage.setItem(STORAGE_KEYS.SCHEDULED_ALERTS, JSON.stringify(data));
          return data as ScheduledAlert[];
        }
      } catch {
        const cached = localStorage.getItem(STORAGE_KEYS.SCHEDULED_ALERTS);
        return (cached ? JSON.parse(cached) : []) as ScheduledAlert[];
      }
      return [] as ScheduledAlert[];
    },
    enabled: !!user,
  });

  // Automated Dispatch Worker for Due Scheduled Alerts
  const processDueAlerts = useCallback(async () => {
    const alertsList = scheduledAlertsQuery.data || [];
    const now = new Date();
    const dueAlerts = alertsList.filter((a) => a.status === 'scheduled' && new Date(a.scheduled_at) <= now);

    if (dueAlerts.length === 0 || !user) return;

    const membersList = monitoringDataQuery.data || [];
    const resolvedPath = resolveDeepLink('/grouping/monitoring?open=survey');

    for (const alert of dueAlerts) {
      let targetUserIds: string[] = [];
      if (alert.target_filter === 'missing_survey') {
        targetUserIds = membersList.filter((m) => !m.dailySurvey.isMet).map((m) => m.userId);
      } else if (alert.target_filter === 'missing_all') {
        targetUserIds = membersList.filter((m) => !m.overallMet).map((m) => m.userId);
      } else if (alert.target_user_ids && alert.target_user_ids.length > 0) {
        targetUserIds = alert.target_user_ids;
      } else {
        targetUserIds = membersList.map((m) => m.userId);
      }

      if (targetUserIds.length > 0) {
        const notifications = targetUserIds.map((uid) => ({
          sender_id: alert.created_by || user.id,
          recipient_id: uid,
          title: alert.title,
          message: alert.message,
          type: 'daily_survey_alert',
          is_read: false,
          metadata: {
            actionable: true,
            path: resolvedPath,
            scheduled_alert_id: alert.id,
          },
        }));

        await supabase.from('grouping_notifications').insert(notifications as any);

        try {
          await supabase.functions.invoke('send-push', {
            body: {
              user_ids: targetUserIds,
              title: `⏰ ${alert.title}`,
              body: alert.message,
              data: { type: 'daily_survey_alert', actionable: 'true', path: resolvedPath },
            },
          });
        } catch {}
      }

      // Mark status as 'sent'
      try {
        await supabase.from('scheduled_monitoring_alerts' as any).update({ status: 'sent' }).eq('id', alert.id);
      } catch {
        const cached = localStorage.getItem(STORAGE_KEYS.SCHEDULED_ALERTS);
        let list = cached ? JSON.parse(cached) : [];
        const item = list.find((a: any) => a.id === alert.id);
        if (item) item.status = 'sent';
        localStorage.setItem(STORAGE_KEYS.SCHEDULED_ALERTS, JSON.stringify(list));
      }
    }

    queryClient.invalidateQueries({ queryKey: ['scheduled-monitoring-alerts'] });
    queryClient.invalidateQueries({ queryKey: ['grouping-notifications'] });
  }, [scheduledAlertsQuery.data, monitoringDataQuery.data, user, queryClient]);

  useEffect(() => {
    processDueAlerts();
    const interval = setInterval(processDueAlerts, 15000);
    return () => clearInterval(interval);
  }, [processDueAlerts]);

  // Realtime Incremental Event Handlers
  const handleIncrementalRealtimeUpdate = useCallback(() => {
    setLastSyncTime(new Date());
    queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
    queryClient.invalidateQueries({ queryKey: ['scheduled-monitoring-alerts'] });
  }, [queryClient]);

  useRealtimeSubscription({
    channelName: 'monitoring-ap-realtime-v6',
    table: 'activity_points',
    onPayload: handleIncrementalRealtimeUpdate,
  });

  useRealtimeSubscription({
    channelName: 'monitoring-ps-realtime-v6',
    table: 'ps_daily_entries',
    onPayload: handleIncrementalRealtimeUpdate,
  });

  // 3. Target Mutations
  const updateTargets = useMutation({
    mutationFn: async (changedTargets: Partial<MonitoringTargets>) => {
      if (!isLeadership) throw new Error('Unauthorized');
      const payload = {
        ...globalTargets,
        ...changedTargets,
        updated_by: user!.id,
        updated_at: new Date().toISOString(),
      };

      try {
        const { data: existing } = await supabase.from('monitoring_targets' as any).select('id').limit(1).maybeSingle();
        if (existing?.id) {
          const { error } = await supabase.from('monitoring_targets' as any).update(changedTargets).eq('id', existing.id);
          if (error && isMissingTableError(error)) {
            localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(payload));
            return;
          }
          if (error) throw error;
        } else {
          const { error } = await supabase.from('monitoring_targets' as any).insert(payload);
          if (error && isMissingTableError(error)) {
            localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(payload));
            return;
          }
          if (error) throw error;
        }
      } catch {
        localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(payload));
      }
      localStorage.setItem(STORAGE_KEYS.TARGETS, JSON.stringify(payload));
    },
    onMutate: async (newTargets) => {
      await queryClient.cancelQueries({ queryKey: ['monitoring-targets'] });
      queryClient.setQueryData(['monitoring-targets'], (old: any) => ({ ...old, ...newTargets }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monitoring-targets'] });
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
      toast({ title: 'Global Targets Updated' });
    },
  });

  const updateIndividualTargets = useMutation({
    mutationFn: async ({
      userId,
      required_ap_target,
      required_ps_target,
      required_meeting_target,
      required_survey_target,
    }: {
      userId: string;
      required_ap_target?: number | null;
      required_ps_target?: number | null;
      required_meeting_target?: number | null;
      required_survey_target?: number | null;
    }) => {
      if (!isLeadership) throw new Error('Unauthorized');

      const overrideObj: any = {
        user_id: userId,
        updated_by: user!.id,
        updated_at: new Date().toISOString(),
      };
      if (required_ap_target !== undefined) overrideObj.required_ap_target = required_ap_target;
      if (required_ps_target !== undefined) overrideObj.required_ps_target = required_ps_target;
      if (required_meeting_target !== undefined) overrideObj.required_meeting_target = required_meeting_target;
      if (required_survey_target !== undefined) overrideObj.required_survey_target = required_survey_target;

      try {
        const { error } = await supabase.from('individual_monitoring_targets' as any).upsert(overrideObj, { onConflict: 'user_id' });
        if (error && isMissingTableError(error)) {
          const cached = localStorage.getItem(STORAGE_KEYS.INDIVIDUAL_TARGETS);
          const list = cached ? JSON.parse(cached) : [];
          const idx = list.findIndex((item: any) => item.user_id === userId);
          if (idx >= 0) list[idx] = { ...list[idx], ...overrideObj };
          else list.push(overrideObj);
          localStorage.setItem(STORAGE_KEYS.INDIVIDUAL_TARGETS, JSON.stringify(list));
          return;
        }
        if (error) throw error;
      } catch {
        const cached = localStorage.getItem(STORAGE_KEYS.INDIVIDUAL_TARGETS);
        const list = cached ? JSON.parse(cached) : [];
        const idx = list.findIndex((item: any) => item.user_id === userId);
        if (idx >= 0) list[idx] = { ...list[idx], ...overrideObj };
        else list.push(overrideObj);
        localStorage.setItem(STORAGE_KEYS.INDIVIDUAL_TARGETS, JSON.stringify(list));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
      toast({ title: 'Member Target Column Updated' });
    },
  });

  // 4. Send Actionable Daily Survey Notification Prompt with Resolved Route
  const sendDailySurveyActionablePrompt = useMutation({
    mutationFn: async (targetUserId?: string) => {
      if (!user) throw new Error('Not authenticated');
      const recipientId = targetUserId || user.id;

      const membersList = monitoringDataQuery.data || [];
      const member = membersList.find((m) => m.userId === recipientId);

      const apAchieved = member ? member.ap.achieved : 0;
      const apTarget = member ? member.ap.target : 4200;
      const psMet = member ? member.ps.isMet : false;
      const surveyAchieved = member ? member.dailySurvey.achieved : 0;
      const surveyTarget = member ? member.dailySurvey.target : 4;

      const promptTitle = '📋 Daily Survey Requirement Status';
      const promptMessage = `Your current status:\n• Your current AP: ${apAchieved} / ${apTarget} AP\n• Minimum PS: ${psMet ? 'Completed' : 'Not Completed'}\n• Daily survey: ${surveyAchieved} / ${surveyTarget}`;
      const resolvedPath = resolveDeepLink('/grouping/monitoring?open=survey');

      await supabase.from('grouping_notifications').insert({
        sender_id: user.id,
        recipient_id: recipientId,
        title: promptTitle,
        message: promptMessage,
        type: 'daily_survey_alert',
        is_read: false,
        metadata: {
          actionable: true,
          path: resolvedPath,
          ap_status: `${apAchieved} / ${apTarget}`,
          ps_status: psMet ? 'Completed' : 'Not Completed',
          survey_status: `${surveyAchieved} / ${surveyTarget}`,
        },
      } as any);

      try {
        await supabase.functions.invoke('send-push', {
          body: {
            user_ids: [recipientId],
            title: promptTitle,
            body: promptMessage,
            data: { type: 'daily_survey_alert', actionable: 'true', path: resolvedPath },
          },
        });
      } catch {}
    },
    onSuccess: () => {
      toast({ title: 'Survey Action Prompt Sent!', description: 'Actionable prompt delivered with deep link.' });
    },
  });

  // 5. Actionable Response Handler: Source of Truth Increment
  const handleActionableResponse = useMutation({
    mutationFn: async ({ alertId, action }: { alertId?: string; action: 'completed' | 'not_yet' }) => {
      if (!user) throw new Error('Not authenticated');

      if (action === 'completed') {
        const todayStr = new Date().toISOString().split('T')[0];

        // Find current user's current survey count
        const membersList = monitoringDataQuery.data || [];
        const currentMember = membersList.find((m) => m.userId === user.id);
        const currentCount = currentMember ? currentMember.dailySurvey.achieved : 0;
        const targetCount = currentMember ? currentMember.dailySurvey.target : 4;
        const nextCount = Math.min(targetCount, currentCount + 1);

        const surveyRecord = {
          user_id: user.id,
          survey_date: todayStr,
          answers: { response_count: nextCount, source: 'actionable_push_completed_click', alert_id: alertId || null },
          completed_at: new Date().toISOString(),
        };

        try {
          const { error } = await supabase.from('daily_survey_responses' as any).upsert(surveyRecord, { onConflict: 'user_id,survey_date' });
          if (error && isMissingTableError(error)) {
            const cached = localStorage.getItem(STORAGE_KEYS.SURVEY_RESPONSES);
            let list = cached ? JSON.parse(cached) : [];
            list = list.filter((r: any) => !(r.user_id === user.id && r.survey_date === todayStr));
            list.push(surveyRecord);
            localStorage.setItem(STORAGE_KEYS.SURVEY_RESPONSES, JSON.stringify(list));
          }
        } catch {
          const cached = localStorage.getItem(STORAGE_KEYS.SURVEY_RESPONSES);
          let list = cached ? JSON.parse(cached) : [];
          list = list.filter((r: any) => !(r.user_id === user.id && r.survey_date === todayStr));
          list.push(surveyRecord);
          localStorage.setItem(STORAGE_KEYS.SURVEY_RESPONSES, JSON.stringify(list));
        }

        // Also record PS completion
        try {
          const { data: psEntries } = await supabase
            .from('ps_daily_entries')
            .select('id')
            .eq('user_id', user.id)
            .eq('entry_date', todayStr);

          if (!psEntries || psEntries.length === 0) {
            const { data: activeSession } = await supabase.from('grouping_sessions').select('id').eq('status', 'active').limit(1).maybeSingle();
            await supabase.from('ps_daily_entries').insert({
              s_no: 1,
              session_id: activeSession?.id || '00000000-0000-0000-0000-000000000000',
              user_id: user.id,
              entry_date: todayStr,
              skill_name: 'PS Requirement (Actionable Click)',
              reward_points: 10,
              attempt_count: 1,
              entered_by: user.id,
              status: 'completed',
              completed_at: new Date().toISOString(),
            } as any);
          }
        } catch {}

        if (alertId) {
          try {
            await supabase.from('grouping_notifications').update({ is_read: true }).eq('id', alertId);
          } catch {}
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      toast({ title: 'Survey Count Updated Instantly!', description: 'Survey count +1 & PS verified in DB.' });
    },
  });

  // 6. Set Member Daily Survey Count (Upsert with response_count)
  const setMemberSurveyCount = useMutation({
    mutationFn: async ({ userId, count }: { userId: string; count: number }) => {
      if (!isLeadership) throw new Error('Unauthorized: Leads only');
      const todayStr = new Date().toISOString().split('T')[0];

      const record = {
        user_id: userId,
        survey_date: todayStr,
        answers: { response_count: count, source: 'lead_override', updated_by: user!.id },
        completed_at: new Date().toISOString(),
      };

      try {
        const { error } = await supabase.from('daily_survey_responses' as any).upsert(record, { onConflict: 'user_id,survey_date' });
        if (error && isMissingTableError(error)) {
          const cached = localStorage.getItem(STORAGE_KEYS.SURVEY_RESPONSES);
          let list = cached ? JSON.parse(cached) : [];
          list = list.filter((r: any) => !(r.user_id === userId && r.survey_date === todayStr));
          list.push(record);
          localStorage.setItem(STORAGE_KEYS.SURVEY_RESPONSES, JSON.stringify(list));
        }
      } catch {
        const cached = localStorage.getItem(STORAGE_KEYS.SURVEY_RESPONSES);
        let list = cached ? JSON.parse(cached) : [];
        list = list.filter((r: any) => !(r.user_id === userId && r.survey_date === todayStr));
        list.push(record);
        localStorage.setItem(STORAGE_KEYS.SURVEY_RESPONSES, JSON.stringify(list));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
      toast({ title: 'Survey Count Updated' });
    },
  });

  // 7. Bulk Member Operations
  const bulkUpdateMembers = useMutation({
    mutationFn: async ({
      userIds,
      field,
      value,
    }: {
      userIds: string[];
      field: 'ap' | 'ps' | 'meeting' | 'survey';
      value: any;
    }) => {
      if (!isLeadership) throw new Error('Unauthorized');
      if (userIds.length === 0) return;

      const todayStr = new Date().toISOString().split('T')[0];

      if (field === 'ap') {
        const delta = typeof value === 'number' ? value : parseInt(value, 10);
        const { data: session } = await supabase.from('grouping_sessions').select('id').limit(1).maybeSingle();
        const sessionId = session?.id || '00000000-0000-0000-0000-000000000000';

        for (const uid of userIds) {
          const { data: existing } = await supabase.from('activity_points').select('id, points').eq('user_id', uid).limit(1).maybeSingle();
          if (existing?.id) {
            await supabase.from('activity_points').update({ points: (existing.points || 0) + delta }).eq('id', existing.id);
          } else {
            await supabase.from('activity_points').insert({ user_id: uid, session_id: sessionId, points: delta, reason: 'Bulk AP update', awarded_by: user!.id });
          }
        }
      } else if (field === 'ps') {
        const status = value as 'completed' | 'pending';
        const { data: activeSession } = await supabase.from('grouping_sessions').select('id').eq('status', 'active').limit(1).maybeSingle();
        const sessionId = activeSession?.id || '00000000-0000-0000-0000-000000000000';

        for (const uid of userIds) {
          if (status === 'completed') {
            await supabase.from('ps_daily_entries').insert({
              s_no: 1,
              session_id: sessionId,
              user_id: uid,
              entry_date: todayStr,
              skill_name: 'PS Requirement (Bulk Lead Override)',
              reward_points: 0, // NO POINTS AWARDED FOR BULK OVERRIDE ENTRIES
              attempt_count: 1,
              entered_by: user!.id,
              status: 'completed',
              completed_at: new Date().toISOString(),
            } as any);
          } else {
            await supabase.from('ps_daily_entries').update({ status: 'pending', completed_at: null }).eq('user_id', uid).eq('entry_date', todayStr);
          }
        }
      } else if (field === 'meeting') {
        const status = value as 'completed' | 'pending';
        for (const uid of userIds) {
          const record = { user_id: uid, meeting_date: todayStr, status, updated_by: user!.id };
          try {
            await supabase.from('monitoring_meeting_records' as any).upsert(record, { onConflict: 'user_id,meeting_date' });
          } catch {
            const cached = localStorage.getItem(STORAGE_KEYS.MEETING_RECORDS);
            let list = cached ? JSON.parse(cached) : [];
            list = list.filter((m: any) => !(m.user_id === uid && m.meeting_date === todayStr));
            if (status === 'completed') list.push(record);
            localStorage.setItem(STORAGE_KEYS.MEETING_RECORDS, JSON.stringify(list));
          }
        }
      } else if (field === 'survey') {
        const count = typeof value === 'number' ? value : parseInt(value, 10);
        for (const uid of userIds) {
          const record = {
            user_id: uid,
            survey_date: todayStr,
            answers: { response_count: count, source: 'bulk_lead_override', updated_by: user!.id },
            completed_at: new Date().toISOString(),
          };

          try {
            await supabase.from('daily_survey_responses' as any).upsert(record, { onConflict: 'user_id,survey_date' });
          } catch {
            const cached = localStorage.getItem(STORAGE_KEYS.SURVEY_RESPONSES);
            let list = cached ? JSON.parse(cached) : [];
            list = list.filter((r: any) => !(r.user_id === uid && r.survey_date === todayStr));
            list.push(record);
            localStorage.setItem(STORAGE_KEYS.SURVEY_RESPONSES, JSON.stringify(list));
          }
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
      queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      toast({ title: 'Bulk Update Success', description: `Updated ${vars.userIds.length} members.` });
    },
  });

  // 8. Scheduled Alert Mutations
  const createScheduledAlert = useMutation({
    mutationFn: async ({
      title,
      message,
      target_filter,
      target_user_ids,
      scheduled_at,
    }: {
      title: string;
      message: string;
      target_filter: string;
      target_user_ids?: string[];
      scheduled_at: string;
    }) => {
      if (!isLeadership) throw new Error('Unauthorized');
      const idempotent_key = `sched_alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newAlert = {
        title,
        message,
        target_filter,
        target_user_ids,
        scheduled_at,
        status: 'scheduled',
        idempotent_key,
        created_by: user!.id,
        created_at: new Date().toISOString(),
      };

      try {
        const { error } = await supabase.from('scheduled_monitoring_alerts' as any).insert(newAlert);
        if (error && isMissingTableError(error)) {
          const cached = localStorage.getItem(STORAGE_KEYS.SCHEDULED_ALERTS);
          const list = cached ? JSON.parse(cached) : [];
          list.push({ ...newAlert, id: idempotent_key });
          localStorage.setItem(STORAGE_KEYS.SCHEDULED_ALERTS, JSON.stringify(list));
          return;
        }
        if (error) throw error;
      } catch {
        const cached = localStorage.getItem(STORAGE_KEYS.SCHEDULED_ALERTS);
        const list = cached ? JSON.parse(cached) : [];
        list.push({ ...newAlert, id: idempotent_key });
        localStorage.setItem(STORAGE_KEYS.SCHEDULED_ALERTS, JSON.stringify(list));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-monitoring-alerts'] });
      toast({ title: 'Survey Alert Scheduled', description: 'Idempotent schedule registered.' });
    },
  });

  const cancelScheduledAlert = useMutation({
    mutationFn: async (alertId: string) => {
      if (!isLeadership) throw new Error('Unauthorized');
      try {
        const { error } = await supabase.from('scheduled_monitoring_alerts' as any).update({ status: 'cancelled' }).eq('id', alertId);
        if (error && isMissingTableError(error)) {
          const cached = localStorage.getItem(STORAGE_KEYS.SCHEDULED_ALERTS);
          const list = cached ? JSON.parse(cached) : [];
          const item = list.find((a: any) => a.id === alertId);
          if (item) item.status = 'cancelled';
          localStorage.setItem(STORAGE_KEYS.SCHEDULED_ALERTS, JSON.stringify(list));
          return;
        }
      } catch {
        const cached = localStorage.getItem(STORAGE_KEYS.SCHEDULED_ALERTS);
        const list = cached ? JSON.parse(cached) : [];
        const item = list.find((a: any) => a.id === alertId);
        if (item) item.status = 'cancelled';
        localStorage.setItem(STORAGE_KEYS.SCHEDULED_ALERTS, JSON.stringify(list));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-monitoring-alerts'] });
      toast({ title: 'Scheduled Alert Cancelled' });
    },
  });

  // 9. Send Alert ONLY to Incomplete Members
  const sendLeadAlert = useMutation({
    mutationFn: async ({
      recipientIds,
      title,
      messagePrefix,
      alertType,
      onlyIncomplete = true,
      expiryHours = 24,
    }: {
      recipientIds: string[];
      title: string;
      messagePrefix?: string;
      alertType: string;
      onlyIncomplete?: boolean;
      expiryHours?: number;
    }) => {
      if (!isLeadership) throw new Error('Unauthorized');

      const membersList = monitoringDataQuery.data || [];
      const filteredRecipients = recipientIds.filter((uid) => {
        const m = membersList.find((mem) => mem.userId === uid);
        if (!m) return false;
        if (onlyIncomplete) return !m.overallMet;
        return true;
      });

      if (filteredRecipients.length === 0) {
        toast({ title: 'No Alerts Sent', description: 'All selected members have already completed their requirements!' });
        return;
      }

      const expHours = expiryHours === 48 ? 48 : 24;
      const expiresAtIso = new Date(Date.now() + expHours * 60 * 60 * 1000).toISOString();
      const notificationsToInsert = [];
      const resolvedPath = resolveDeepLink('/grouping/monitoring');

      for (const uid of filteredRecipients) {
        const member = membersList.find((m) => m.userId === uid);
        const missingParts: string[] = [];

        if (member) {
          if (!member.ap.isMet) missingParts.push(`AP (Needs ${member.ap.remaining} AP)`);
          if (!member.ps.isMet) missingParts.push(`PS (Needs ${member.ps.remaining} entry)`);
          if (!member.dailySurvey.isMet) missingParts.push(`Daily Survey (Needs ${member.dailySurvey.remaining} response(s))`);
          if (!member.groupMeeting.isMet) missingParts.push(`Group Meeting (Needs ${member.groupMeeting.remaining})`);
        }

        const missingDetailsStr = missingParts.length > 0 ? `Missing Requirements: ${missingParts.join(', ')}.` : 'Requirements Pending.';
        const fullMessage = messagePrefix ? `${messagePrefix} ${missingDetailsStr}` : missingDetailsStr;

        notificationsToInsert.push({
          sender_id: user!.id,
          recipient_id: uid,
          title,
          message: fullMessage,
          type: alertType,
          is_read: false,
          expires_at: expiresAtIso,
          metadata: {
            actionable: true,
            path: resolvedPath,
            missing_details: missingParts,
            expiry_hours: expHours,
          },
        });

        try {
          await supabase.functions.invoke('send-push', {
            body: {
              user_ids: [uid],
              title: `⚠️ ${title}`,
              body: fullMessage,
              data: { type: alertType, actionable: 'true', path: resolvedPath },
            },
          });
        } catch {}
      }

      await supabase.from('grouping_notifications').insert(notificationsToInsert as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
      toast({ title: 'Alert Dispatched!', description: 'Sent ONLY to members who are still incomplete.' });
    },
  });

  return {
    targets: globalTargets,
    membersMonitoring: monitoringDataQuery.data || [],
    scheduledAlerts: scheduledAlertsQuery.data || [],
    isLoading: monitoringDataQuery.isLoading || targetsQuery.isLoading,
    viewMode,
    setViewMode,
    lastSyncTime,
    updateTargets,
    updateIndividualTargets,
    sendDailySurveyActionablePrompt,
    bulkUpdateMembers,
    createScheduledAlert,
    cancelScheduledAlert,
    updateMemberAP: useMutation({
      mutationFn: async ({ userId, points, reason }: { userId: string; points: number; reason?: string }) => {
        if (!isLeadership) throw new Error('Unauthorized: Only authorized leads can manually edit AP');
        if (isNaN(points) || points < 0) {
          throw new Error('Invalid AP value. AP points must be a valid non-negative number.');
        }

        const { data: session } = await supabase
          .from('grouping_sessions')
          .select('id')
          .limit(1)
          .maybeSingle();

        const sessionId = session?.id || '00000000-0000-0000-0000-000000000000';

        // Fetch ALL existing activity_points rows for this user
        const { data: existingRows } = await supabase
          .from('activity_points')
          .select('id, points')
          .eq('user_id', userId);

        if (existingRows && existingRows.length > 0) {
          // Update primary row to the exact target points
          const mainRowId = existingRows[0].id;
          const { error: updateErr } = await supabase
            .from('activity_points')
            .update({
              points,
              reason: reason || 'Lead manual total AP override',
              awarded_by: user!.id,
              updated_at: new Date().toISOString(),
            } as any)
            .eq('id', mainRowId);

          if (updateErr) throw updateErr;

          // Delete any secondary rows so the database SUM equals EXACTLY `points`
          if (existingRows.length > 1) {
            const extraRowIds = existingRows.slice(1).map((r) => r.id);
            await supabase
              .from('activity_points')
              .delete()
              .in('id', extraRowIds);
          }
        } else {
          // Insert single row with exact target points
          const { error: insertErr } = await supabase
            .from('activity_points')
            .insert({
              user_id: userId,
              session_id: sessionId,
              points,
              reason: reason || 'Lead manual total AP override',
              awarded_by: user!.id,
            } as any);

          if (insertErr) throw insertErr;
        }
      },
      onMutate: async ({ userId, points }) => {
        // 0ms Optimistic UI Update in React Query cache
        await queryClient.cancelQueries({ queryKey: ['centralized-monitoring-data'] });
        queryClient.setQueryData(['centralized-monitoring-data', globalTargets], (oldData: any) => {
          if (!Array.isArray(oldData)) return oldData;
          return oldData.map((m: MemberMonitoringStatus) => {
            if (m.userId !== userId) return m;
            const apTarget = m.ap.target;
            const apAchieved = points;
            const apRem = Math.max(0, apTarget - apAchieved);
            const apMet = apAchieved >= apTarget;
            const apPct = apTarget > 0 ? Math.min(100, Math.round((apAchieved / apTarget) * 100)) : 100;
            const overallMet = apMet && m.ps.isMet && m.groupMeeting.isMet && m.dailySurvey.isMet;

            return {
              ...m,
              ap: {
                ...m.ap,
                achieved: apAchieved,
                remaining: apRem,
                percentage: apPct,
                isMet: apMet,
                displayText: `${apAchieved} / ${apTarget}`,
              },
              overallMet,
              lastUpdated: new Date().toISOString(),
            };
          });
        });
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
        queryClient.invalidateQueries({ queryKey: ['activity-points'] });
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
        queryClient.invalidateQueries({ queryKey: ['grouping-home-stats'] });
        toast({ title: 'Activity Points (AP) Saved!', description: 'AP updated across all dashboards.' });
      },
      onError: (err: any) => {
        queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
        toast({ variant: 'destructive', title: 'Failed to update AP', description: err.message });
      },
    }),
    setMemberPsStatus: useMutation({
      mutationFn: async ({ userId, newStatus, count = 1 }: { userId: string; newStatus: 'completed' | 'pending'; count?: number }) => {
        if (!isLeadership) throw new Error('Unauthorized: Leads only');
        const todayStr = new Date().toISOString().split('T')[0];

        if (newStatus === 'completed') {
          const { data: existing } = await supabase.from('ps_daily_entries').select('id').eq('user_id', userId).eq('entry_date', todayStr);
          const { data: activeSession } = await supabase.from('grouping_sessions').select('id').eq('status', 'active').limit(1).maybeSingle();
          const existingCount = existing?.length || 0;
          if (existingCount < count) {
            const newEntries = Array.from({ length: count - existingCount }).map((_, i) => ({
              s_no: existingCount + i + 1,
              session_id: activeSession?.id || '00000000-0000-0000-0000-000000000000',
              user_id: userId,
              entry_date: todayStr,
              skill_name: 'PS Requirement (Lead Override)',
              reward_points: 0,
              attempt_count: 1,
              entered_by: user!.id,
              status: 'completed',
              completed_at: new Date().toISOString(),
            }));
            await supabase.from('ps_daily_entries').insert(newEntries as any);
          } else {
            await supabase.from('ps_daily_entries').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('user_id', userId).eq('entry_date', todayStr);
          }
        } else {
          await supabase.from('ps_daily_entries').update({ status: 'pending', completed_at: null }).eq('user_id', userId).eq('entry_date', todayStr);
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
        toast({ title: 'PS Board Updated Instantly' });
      },
    }),
    setMemberMeetingStatus: useMutation({
      mutationFn: async ({ userId, status }: { userId: string; status: 'completed' | 'pending' }) => {
        if (!isLeadership) throw new Error('Unauthorized: Leads only');
        const todayStr = new Date().toISOString().split('T')[0];
        const record = { user_id: userId, meeting_date: todayStr, status, updated_by: user!.id };
        try {
          await supabase.from('monitoring_meeting_records' as any).upsert(record, { onConflict: 'user_id,meeting_date' });
        } catch {
          const cached = localStorage.getItem(STORAGE_KEYS.MEETING_RECORDS);
          let list = cached ? JSON.parse(cached) : [];
          list = list.filter((m: any) => !(m.user_id === userId && m.meeting_date === todayStr));
          if (status === 'completed') list.push(record);
          localStorage.setItem(STORAGE_KEYS.MEETING_RECORDS, JSON.stringify(list));
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
        toast({ title: 'Meeting Board Updated Instantly' });
      },
    }),
    setMemberSurveyCount,
    handleActionableResponse,
    submitDailySurvey: useMutation({
      mutationFn: async (answers: Record<string, any>) => {
        if (!user) throw new Error('Not authenticated');
        const todayStr = new Date().toISOString().split('T')[0];
        const record = { user_id: user.id, survey_date: todayStr, answers, completed_at: new Date().toISOString() };
        try {
          await supabase.from('daily_survey_responses' as any).insert(record);
        } catch {
          const cached = localStorage.getItem(STORAGE_KEYS.SURVEY_RESPONSES);
          const list = cached ? JSON.parse(cached) : [];
          list.push(record);
          localStorage.setItem(STORAGE_KEYS.SURVEY_RESPONSES, JSON.stringify(list));
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['centralized-monitoring-data'] });
        toast({ title: 'Daily Survey Board Updated (+1 Count)' });
      },
    }),
    sendLeadAlert,
    isLeadership,
    user,
    refetch: monitoringDataQuery.refetch,
  };
}

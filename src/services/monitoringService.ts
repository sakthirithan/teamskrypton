import { supabase } from '@/integrations/supabase/client';
import { VISIBLE_PROFILE_OR } from '@/lib/profileVisibility';
import { startOfWeek, endOfWeek, format } from 'date-fns';

export interface MonitoringTargetConfig {
  apTarget: number;
  psTarget: number;
  meetingTarget: number;
  surveyTarget: number;
}

export interface MemberMonitoringStatus {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  department?: string;

  // Activity Points (AP)
  ap: {
    target: number;
    achieved: number;
    remaining: number;
    percentage: number;
    criteriaMet: boolean;
    lastUpdated?: string | null;
  };

  // Personalized Skills (PS)
  ps: {
    target: number;
    achieved: number;
    remaining: number;
    percentage: number;
    criteriaMet: boolean;
    displayStatus: string;
  };

  // Group Meeting
  meeting: {
    target: number;
    achieved: number;
    remaining: number;
    percentage: number;
    criteriaMet: boolean;
  };

  // Daily Survey
  survey: {
    target: number;
    achieved: number;
    remaining: number;
    percentage: number;
    criteriaMet: boolean;
  };

  // Penalty & Overall
  negativePenalties: number;
  overallStatus: 'met' | 'missing';
  missingCriteria: string[];
}

export async function fetchMonitoringTargets(sessionId?: string | null): Promise<MonitoringTargetConfig> {
  const defaults: MonitoringTargetConfig = {
    apTarget: 4200,
    psTarget: 1,
    meetingTarget: 1,
    surveyTarget: 4,
  };

  try {
    let query = supabase.from('monitoring_targets' as any).select('*');
    if (sessionId) {
      query = query.or(`session_id.eq.${sessionId},session_id.is.null`);
    } else {
      query = query.is('session_id', null);
    }

    const { data, error } = await query;
    if (error || !data) return defaults;

    data.forEach((row: any) => {
      if (row.target_type === 'ap') defaults.apTarget = row.required_value;
      if (row.target_type === 'ps') defaults.psTarget = row.required_value;
      if (row.target_type === 'meeting') defaults.meetingTarget = row.required_value;
      if (row.target_type === 'survey') defaults.surveyTarget = row.required_value;
    });
  } catch (err) {
    console.warn('Error fetching monitoring targets:', err);
  }

  return defaults;
}

export async function updateMonitoringTarget(
  targetType: 'ap' | 'ps' | 'meeting' | 'survey',
  requiredValue: number,
  sessionId?: string | null,
  userId?: string
): Promise<void> {
  const { error } = await supabase.from('monitoring_targets' as any).upsert(
    {
      session_id: sessionId || null,
      target_type: targetType,
      required_value: requiredValue,
      period: targetType === 'ap' ? 'session' : 'weekly',
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_id,target_type' }
  );

  if (error) throw error;
}

export async function fetchAggregatedMonitoringData(
  sessionId?: string | null
): Promise<{ targets: MonitoringTargetConfig; members: MemberMonitoringStatus[] }> {
  const targets = await fetchMonitoringTargets(sessionId);
  const nowIso = new Date().toISOString();
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // Single Parallel Query Batch for all visible members & activity data
  const [
    profilesRes,
    rolesRes,
    userPointsRes,
    psEntriesRes,
    loginActivityRes,
    surveyResponsesRes,
    pointsHistoryRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('user_id, full_name, email, avatar_url, department, is_disabled, disabled_until, is_test')
      .or(VISIBLE_PROFILE_OR)
      .eq('is_test', false)
      .or(`is_disabled.is.false,is_disabled.is.null,disabled_until.lt.${nowIso}`),
    supabase.from('user_roles').select('user_id, role'),
    supabase.from('user_points').select('user_id, points, last_updated_at'),
    supabase
      .from('ps_daily_entries')
      .select('user_id, status, entry_date')
      .eq('status', 'completed')
      .gte('entry_date', weekStart)
      .lte('entry_date', weekEnd),
    supabase
      .from('user_login_activity')
      .select('user_id, login_date')
      .gte('login_date', weekStart)
      .lte('login_date', weekEnd),
    supabase
      .from('daily_survey_responses' as any)
      .select('user_id, survey_date')
      .gte('survey_date', weekStart)
      .lte('survey_date', weekEnd),
    supabase
      .from('points_history')
      .select('user_id, points_change, operation_type')
      .eq('operation_type', 'penalty'),
  ]);

  if (profilesRes.error) throw profilesRes.error;

  const profiles = profilesRes.data || [];
  const rolesMap = new Map<string, string>();
  (rolesRes.data || []).forEach((r) => rolesMap.set(r.user_id, r.role));

  const userPointsMap = new Map<string, { points: number; lastUpdated: string | null }>();
  (userPointsRes.data || []).forEach((p) =>
    userPointsMap.set(p.user_id, { points: p.points, lastUpdated: p.last_updated_at })
  );

  // Group PS completed counts per user
  const psCountMap = new Map<string, number>();
  (psEntriesRes.data || []).forEach((e) => {
    psCountMap.set(e.user_id, (psCountMap.get(e.user_id) || 0) + 1);
  });

  // Group Meeting attendance count per user
  const meetingCountMap = new Map<string, number>();
  (loginActivityRes.data || []).forEach((l) => {
    meetingCountMap.set(l.user_id, (meetingCountMap.get(l.user_id) || 0) + 1);
  });

  // Group Daily Survey count per user
  const surveyCountMap = new Map<string, number>();
  (surveyResponsesRes.data || []).forEach((s: any) => {
    surveyCountMap.set(s.user_id, (surveyCountMap.get(s.user_id) || 0) + 1);
  });

  // Group Penalty totals per user
  const penaltyMap = new Map<string, number>();
  (pointsHistoryRes.data || []).forEach((ph) => {
    const absVal = Math.abs(ph.points_change);
    penaltyMap.set(ph.user_id, (penaltyMap.get(ph.user_id) || 0) + absVal);
  });

  const members: MemberMonitoringStatus[] = profiles.map((p) => {
    const role = rolesMap.get(p.user_id) || 'member';
    const pointRecord = userPointsMap.get(p.user_id);
    const achievedAp = pointRecord?.points || 0;
    const apRemaining = Math.max(0, targets.apTarget - achievedAp);
    const apPct = Math.min(100, Math.round((achievedAp / Math.max(1, targets.apTarget)) * 100));
    const apMet = achievedAp >= targets.apTarget;

    const achievedPs = psCountMap.get(p.user_id) || 0;
    const psRemaining = Math.max(0, targets.psTarget - achievedPs);
    const psPct = Math.min(100, Math.round((achievedPs / Math.max(1, targets.psTarget)) * 100));
    const psMet = achievedPs >= targets.psTarget;
    const psDisplayStatus =
      targets.psTarget === 1
        ? psMet
          ? 'Completed'
          : 'Pending'
        : `${achievedPs} / ${targets.psTarget}`;

    const achievedMeeting = meetingCountMap.get(p.user_id) || 0;
    const meetingRemaining = Math.max(0, targets.meetingTarget - achievedMeeting);
    const meetingPct = Math.min(100, Math.round((achievedMeeting / Math.max(1, targets.meetingTarget)) * 100));
    const meetingMet = achievedMeeting >= targets.meetingTarget;

    const achievedSurvey = surveyCountMap.get(p.user_id) || 0;
    const surveyRemaining = Math.max(0, targets.surveyTarget - achievedSurvey);
    const surveyPct = Math.min(100, Math.round((achievedSurvey / Math.max(1, targets.surveyTarget)) * 100));
    const surveyMet = achievedSurvey >= targets.surveyTarget;

    const missingCriteria: string[] = [];
    if (!apMet) missingCriteria.push('Activity Points');
    if (!psMet) missingCriteria.push('Personalized Skills');
    if (!meetingMet) missingCriteria.push('Group Meeting');
    if (!surveyMet) missingCriteria.push('Daily Survey');

    const overallStatus = missingCriteria.length === 0 ? 'met' : 'missing';

    return {
      userId: p.user_id,
      fullName: p.full_name || 'Member',
      email: p.email || '',
      role,
      avatarUrl: p.avatar_url,
      department: p.department,

      ap: {
        target: targets.apTarget,
        achieved: achievedAp,
        remaining: apRemaining,
        percentage: apPct,
        criteriaMet: apMet,
        lastUpdated: pointRecord?.lastUpdated || null,
      },

      ps: {
        target: targets.psTarget,
        achieved: achievedPs,
        remaining: psRemaining,
        percentage: psPct,
        criteriaMet: psMet,
        displayStatus: psDisplayStatus,
      },

      meeting: {
        target: targets.meetingTarget,
        achieved: achievedMeeting,
        remaining: meetingRemaining,
        percentage: meetingPct,
        criteriaMet: meetingMet,
      },

      survey: {
        target: targets.surveyTarget,
        achieved: achievedSurvey,
        remaining: surveyRemaining,
        percentage: surveyPct,
        criteriaMet: surveyMet,
      },

      negativePenalties: penaltyMap.get(p.user_id) || 0,
      overallStatus,
      missingCriteria,
    };
  });

  return { targets, members };
}

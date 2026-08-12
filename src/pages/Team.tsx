import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/hooks/useAppMode';
import { Header } from '@/components/layout/Header';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { KryptonIdCard } from '@/components/team/KryptonIdCard';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { KryptonRole, TaskStatus, LEADERSHIP_ROLES, ROLE_LABELS } from '@/lib/constants';
import { Users, Download, Search, AlertCircle, Target, FileSpreadsheet, Layers } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { validateExportDateRange, getTodayString } from '@/lib/exportValidation';
import { calculateTargetStatus, calculateDaysRemaining, calculateSessionDays, TARGET_STATUS_LABELS } from '@/lib/groupingConstants';
import * as XLSX from 'xlsx';

import { SKILL_TYPE_LABELS, SKILL_DOMAIN_LABELS, getEffectiveDomain, SkillType, SkillDomain } from '@/hooks/useMemberSkills';
import { VISIBLE_PROFILE_OR } from '@/lib/profileVisibility';

interface MemberSkillSummary {
  skill_name: string;
  skill_type: SkillType;
  domain: string;
  custom_domain: string | null;
}

interface TeamMember {
  profile: {
    user_id: string;
    full_name: string;
    email: string;
    department: string;
    avatar_url: string | null;
    current_status: TaskStatus | null;
    created_at: string;
    phone_number: string | null;
    register_number: string | null;
  };
  role: KryptonRole | null;
  taskStats: {
    total: number;
    completed: number;
    inProgress: boolean;
  };
  skills: MemberSkillSummary[];
  communities: string[];
}

const Team = () => {
  const { user, isLoading, isLeadership, isCaptainOrVice, role } = useAuth();
  const { mode, isGroupingMode } = useAppMode();
  const { toast } = useToast();
  
  const navigate = useNavigate();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const handleManualRefresh = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 1000) return;
    lastRefreshRef.current = now;
    
    setIsRefreshing(true);
    await fetchMembers();
    setIsRefreshing(false);
    toast({ title: 'Team data refreshed' });
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  const fetchMembers = async () => {
    // Fetch profiles (exclude currently-disabled users; auto-restore expired ones)
    const nowIso = new Date().toISOString();
    let query = supabase
      .from('profiles')
      .select('*').or(VISIBLE_PROFILE_OR)
      .eq('is_test', false)
      .order('full_name');
    // Hide disabled users unless their disabled_until has passed
    query = query.or(`is_disabled.is.false,is_disabled.is.null,disabled_until.lt.${nowIso}`);
    const { data: profiles } = await query;

    // Fetch roles
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role');

    // Fetch task stats for each user (only for PBL mode display)
    const { data: tasks } = await supabase
      .from('tasks')
      .select('assigned_to, status')
      .eq('is_test', false);

    // Fetch member skills
    const { data: memberSkills } = await supabase
      .from('member_skills')
      .select('user_id, skill_name, skill_type, domain, custom_domain');

    // Fetch member communities
    const { data: memberCommunities } = await supabase
      .from('member_communities')
      .select('user_id, community_name');

    if (profiles) {
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role as KryptonRole]) || []);
      
      // Build task stats map
      const taskStatsMap = new Map<string, { total: number; completed: number; inProgress: boolean }>();
      tasks?.forEach(t => {
        const userId = t.assigned_to;
        if (!taskStatsMap.has(userId)) {
          taskStatsMap.set(userId, { total: 0, completed: 0, inProgress: false });
        }
        const stats = taskStatsMap.get(userId)!;
        stats.total++;
        if (t.status === 'completed') stats.completed++;
        if (t.status === 'working') stats.inProgress = true;
      });

      // Build skills map
      const skillsMap = new Map<string, MemberSkillSummary[]>();
      memberSkills?.forEach(s => {
        if (!skillsMap.has(s.user_id)) {
          skillsMap.set(s.user_id, []);
        }
        skillsMap.get(s.user_id)!.push({
          skill_name: s.skill_name,
          skill_type: s.skill_type as SkillType,
          domain: s.domain,
          custom_domain: s.custom_domain,
        });
      });

      // Build communities map
      const communitiesMap = new Map<string, string[]>();
      profiles.forEach(p => communitiesMap.set(p.user_id, []));
      memberCommunities?.forEach(c => {
        if (communitiesMap.has(c.user_id)) {
          communitiesMap.get(c.user_id)!.push(c.community_name);
        }
      });

      const teamMembers: TeamMember[] = profiles.map(p => ({
        profile: {
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          department: p.department,
          avatar_url: p.avatar_url,
          current_status: p.current_status as TaskStatus | null,
          created_at: p.created_at,
          phone_number: p.phone_number,
          register_number: (p as any).register_number,
        },
        role: roleMap.get(p.user_id) || null,
        taskStats: taskStatsMap.get(p.user_id) || { total: 0, completed: 0, inProgress: false },
        skills: skillsMap.get(p.user_id) || [],
        communities: communitiesMap.get(p.user_id) || [],
      }));

      // Sort: Leadership first, then alphabetically
      teamMembers.sort((a, b) => {
        const aIsLeadership = a.role && LEADERSHIP_ROLES.includes(a.role);
        const bIsLeadership = b.role && LEADERSHIP_ROLES.includes(b.role);
        if (aIsLeadership && !bIsLeadership) return -1;
        if (!aIsLeadership && bIsLeadership) return 1;
        return a.profile.full_name.localeCompare(b.profile.full_name);
      });

      setMembers(teamMembers);
    }
    setIsFetching(false);
  };

  useEffect(() => {
    if (user) fetchMembers();
  }, [user]);

  // Update phone number - TL/VC only
  const handleUpdatePhone = async (userId: string, phone: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ phone_number: phone })
      .eq('user_id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update phone number' });
    } else {
      toast({ title: 'Phone Updated' });
      fetchMembers();
    }
  };

  const handleUpdateRegisterNumber = async (userId: string, registerNumber: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ register_number: registerNumber } as any)
      .eq('user_id', userId);

    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update register number' });
    } else {
      toast({ title: 'Register Number Updated' });
      fetchMembers();
    }
  };

  // =================== GROUPING MODE EXPORT ===================
  const handleGroupingExport = async (exportFormat: 'csv' | 'xlsx') => {
    setIsExporting(true);
    setExportError(null);

    try {
      // 1. Get active session
      const { data: sessions, error: sessionError } = await supabase
        .from('grouping_sessions')
        .select('*')
        .eq('status', 'active')
        .eq('is_test', false)
        .order('session_number', { ascending: false })
        .limit(1);

      if (sessionError) throw sessionError;
      
      if (!sessions || sessions.length === 0) {
        setExportError('No active session found. Please create an active session first.');
        setIsExporting(false);
        return;
      }

      const activeSession = sessions[0];

      // 2. Fetch ALL targets for this session
      const { data: targets, error: targetsError } = await supabase
        .from('grouping_targets')
        .select('*')
        .eq('session_id', activeSession.id)
        .eq('is_test', false);

      if (targetsError) throw targetsError;

      // 3. Fetch ALL PS entries for this session
      const { data: psEntries, error: entriesError } = await supabase
        .from('ps_daily_entries')
        .select('*')
        .eq('session_id', activeSession.id)
        .eq('is_test', false);

      if (entriesError) throw entriesError;

      // 4. Fetch ALL completed PS entries for leaderboard PS rank calculation
      const { data: allCompletedPs } = await supabase
        .from('ps_daily_entries')
        .select('user_id, reward_points')
        .eq('status', 'completed');

      const psScoreMap = new Map<string, number>();
      (allCompletedPs || []).forEach(r => {
        psScoreMap.set(r.user_id, (psScoreMap.get(r.user_id) || 0) + (r.reward_points || 0));
      });

      // 5. Fetch Activity points for leaderboard AP rank calculation
      const { data: allActivityPoints } = await supabase
        .from('activity_points')
        .select('user_id, points');

      const apScoreMap = new Map<string, number>();
      (allActivityPoints || []).forEach(r => {
        apScoreMap.set(r.user_id, (apScoreMap.get(r.user_id) || 0) + (r.points || 0));
      });

      // 6. Fetch Golden points for leaderboard GP rank calculation
      const { data: allGoldenPoints } = await supabase
        .from('user_points')
        .select('user_id, points');

      const gpScoreMap = new Map<string, number>();
      (allGoldenPoints || []).forEach(r => {
        gpScoreMap.set(r.user_id, r.points || 0);
      });

      // 7. Fetch member skills for skills breakdown & domain export
      const { data: allSkills } = await supabase
        .from('member_skills')
        .select('user_id, skill_name, skill_type, domain, custom_domain');

      // Helper function to calculate dense rank
      const computeRank = (m: Map<string, number>, targetId: string) => {
        const points = m.get(targetId) || 0;
        if (m.size === 0) return { rank: null, points };
        const scored = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
        let rank = 0;
        let lastVal: number | null = null;
        for (const [uid, val] of scored) {
          if (val !== lastVal) {
            rank += 1;
            lastVal = val;
          }
          if (uid === targetId) return { rank, points };
        }
        return { rank: scored.length + 1, points };
      };

      // 8. Build per-member data
      const groupTarget = targets?.find(t => t.target_scope === 'group');
      const totalDays = calculateSessionDays(activeSession.start_date, activeSession.end_date);
      const daysRemaining = calculateDaysRemaining(activeSession.end_date);

      const exportData = members.map(member => {
        const userId = member.profile.user_id;

        // Member Skills
        const userSkills = (allSkills || []).filter(s => s.user_id === userId);
        const primarySkills = userSkills.filter(s => s.skill_type === 'primary');
        const secondarySkills = userSkills.filter(s => s.skill_type === 'secondary');
        const specSkills = userSkills.filter(s => s.skill_type === 'specialization');

        const primaryStr = primarySkills
          .map(s => `${s.skill_name} (${getEffectiveDomain(s.skill_name, s.domain, s.custom_domain)})`)
          .join(', ');

        const secondaryStr = secondarySkills
          .map(s => `${s.skill_name} (${getEffectiveDomain(s.skill_name, s.domain, s.custom_domain)})`)
          .join(', ');

        const specStr = specSkills
          .map(s => `${s.skill_name} (${getEffectiveDomain(s.skill_name, s.domain, s.custom_domain)})`)
          .join(', ');

        const allSkillsSummaryStr = userSkills
          .map(s => `[${s.skill_type.toUpperCase()}] ${s.skill_name} (${getEffectiveDomain(s.skill_name, s.domain, s.custom_domain)})`)
          .join('; ');

        // Leaderboard Ranks & Points
        const psData = computeRank(psScoreMap, userId);
        const apData = computeRank(apScoreMap, userId);
        const gpData = computeRank(gpScoreMap, userId);

        // Session Entries & Target
        const individualTarget = targets?.find(t => t.target_scope === 'individual' && t.user_id === userId);
        const userEntries = psEntries?.filter(e => e.user_id === userId) || [];
        const completedEntries = userEntries.filter(e => e.status === 'completed');
        const pendingEntries = userEntries.filter(e => e.status === 'pending');
        const attemptEntries = userEntries.filter(e => e.status === 'attempt');

        const completedPoints = completedEntries.reduce((sum, e) => sum + e.reward_points, 0);
        const pendingPointsSum = pendingEntries.reduce((sum, e) => sum + e.reward_points, 0);
        const attemptPointsSum = attemptEntries.reduce((sum, e) => sum + e.reward_points, 0);
        const totalAttempts = userEntries.reduce((sum, e) => sum + e.attempt_count, 0);

        const lastEntry = userEntries.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];

        const targetPoints = individualTarget?.target_points || 0;
        const targetStatus = targetPoints > 0 
          ? calculateTargetStatus(completedPoints, targetPoints, daysRemaining, totalDays)
          : 'on_track';

        const progressPercent = targetPoints > 0 
          ? Math.min(100, Math.round((completedPoints / targetPoints) * 100))
          : 0;

        if (exportFormat === 'xlsx') {
          const uniqueDomains = Array.from(
            new Set(userSkills.map((s) => getEffectiveDomain(s.skill_name, s.domain, s.custom_domain)))
          );

          return {
            'Member Name': member.profile.full_name,
            'Role': member.role ? ROLE_LABELS[member.role] : '-',
            'Department': member.profile.department,
            'Email': member.profile.email,
            'Phone Number': member.profile.phone_number || '-',
            'Register Number': member.profile.register_number || '-',

            // Skills & Domains
            'Primary Skills': primarySkills.map((s) => s.skill_name).join(' | ') || '-',
            'Secondary Skills': secondarySkills.map((s) => s.skill_name).join(' | ') || '-',
            'Specialization Skills': specSkills.map((s) => s.skill_name).join(' | ') || '-',
            'Skill Domains': uniqueDomains.join(' | ') || '-',
            'Total Skills Count': userSkills.length,

            // Communities
            'Communities': (member.communities || []).join(' | ') || '-',
            'Communities Count': (member.communities || []).length,

            // Targets & Progress
            'Individual Target (Points)': targetPoints,
            'Group Target (Points)': groupTarget?.target_points || 0,
            'Contribution Points': apData.points || completedPoints || 0,
            'Target Status': TARGET_STATUS_LABELS[targetStatus],
            'Progress (%)': `${progressPercent}%`,

            // Leaderboard Ranks & Performance Indicators
            'PS Rank': psData.rank ? `#${psData.rank}` : '-',
            'PS Score (Points)': psData.points,
            'Activity Rank': apData.rank ? `#${apData.rank}` : '-',
            'Activity Points': apData.points,
            'Golden Rank': gpData.rank ? `#${gpData.rank}` : '-',
            'Golden Points': gpData.points,

            // Sprint / Session Summary
            'Current Sprint / Session': activeSession.name,
            'Session Dates': `${activeSession.start_date} to ${activeSession.end_date}`,
            'Session Status': activeSession.status,
            'Days Remaining': daysRemaining,
            'Total Session Days': totalDays,

            // Current Progress Summaries
            'Completed Summary': `${completedEntries.length} completed (${completedPoints} pts)`,
            'Pending Summary': `${pendingEntries.length} pending (${pendingPointsSum} pts)`,
            'Attempt Summary': `${attemptEntries.length} attempt(s) (${attemptPointsSum} pts)`,
            'Current Total Points': completedPoints + ((individualTarget as any)?.balance_points || 0),
          };
        }

        return {
          'Member Name': member.profile.full_name,
          'Role': member.role ? ROLE_LABELS[member.role] : '-',
          'Department': member.profile.department,
          'Email': member.profile.email,
          'Phone Number': member.profile.phone_number || '-',
          'Register Number': member.profile.register_number || '-',

          // Skills Breakdown
          'Primary Skills Count': primarySkills.length,
          'Primary Skills': primaryStr || '-',
          'Secondary Skills Count': secondarySkills.length,
          'Secondary Skills': secondaryStr || '-',
          'Specialization Count': specSkills.length,
          'Specialization Skills': specStr || '-',
          'Total Skills Count': userSkills.length,
          'All Skills Summary': allSkillsSummaryStr || '-',

          // Leaderboard Ranks & Points
          'PS Rank': psData.rank ? `#${psData.rank}` : '-',
          'PS Score (Points)': psData.points,
          'Activity Rank': apData.rank ? `#${apData.rank}` : '-',
          'Activity Points': apData.points,
          'Golden Rank': gpData.rank ? `#${gpData.rank}` : '-',
          'Golden Points': gpData.points,

          // Sprint / Session Info
          'Session Name': activeSession.name,
          'Session Start': activeSession.start_date,
          'Session End': activeSession.end_date,
          'Session Status': activeSession.status,
          'Days Remaining': daysRemaining,
          'Total Session Days': totalDays,

          // Target & Progress Info
          'Individual Target (Points)': targetPoints,
          'Individual Achieved (Points)': completedPoints,
          'Progress (%)': progressPercent,
          'Target Status': TARGET_STATUS_LABELS[targetStatus],
          'Group Target (Points)': groupTarget?.target_points || 0,
          'Group Target Achieved': groupTarget?.achieved_points || 0,

          // Entries & Point Summaries
          'Total PS Entries': userEntries.length,
          'Completed Entries': completedEntries.length,
          'Completed Points': completedPoints,
          'Pending Entries': pendingEntries.length,
          'Pending Points': pendingPointsSum,
          'Attempt Entries': attemptEntries.length,
          'Attempt Points': attemptPointsSum,
          'Total Attempts': totalAttempts,
          'Last Activity': lastEntry ? format(new Date(lastEntry.updated_at), 'yyyy-MM-dd HH:mm') : '-',
        };
      });

      // 9. Generate file with clean column widths
      const ws = XLSX.utils.json_to_sheet(exportData);
      if (exportData.length > 0) {
        const keys = Object.keys(exportData[0] || {});
        const colWidths = keys.map((key) => {
          let maxLen = key.length;
          exportData.forEach((row: any) => {
            const val = row[key];
            if (val !== undefined && val !== null) {
              const valStr = String(val);
              if (valStr.length > maxLen) maxLen = valStr.length;
            }
          });
          return { wch: Math.min(Math.max(maxLen + 4, 15), 45) };
        });
        ws['!cols'] = colWidths;
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Team Overview');

      const timestamp = format(new Date(), 'yyyy-MM-dd');
      const sessionName = activeSession.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Grouping_Team_MySpace_Report_${sessionName}_${timestamp}.${exportFormat}`;
      
      XLSX.writeFile(wb, filename);
      toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
      setShowExportDialog(false);

    } catch (error: any) {
      setExportError(error.message || 'Export failed');
      toast({ variant: 'destructive', title: 'Export Failed', description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  // =================== PBL MODE EXPORT ===================
  const handlePBLExport = async (exportFormat: 'csv' | 'xlsx') => {
    const validation = validateExportDateRange(fromDate, toDate);
    if (!validation.isValid) {
      setExportError(validation.error);
      return;
    }
    setExportError(null);
    setIsExporting(true);

    try {
      // Fetch all completed tasks with date filter
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('status', 'completed')
        .eq('is_test', false);

      const { data: allTasks } = await query;

      let filteredTasks = allTasks || [];
      if (fromDate || toDate) {
        filteredTasks = filteredTasks.filter(task => {
          const taskDate = task.completed_at ? new Date(task.completed_at) : null;
          if (!taskDate) return false;
          if (fromDate && taskDate < parseISO(fromDate)) return false;
          if (toDate && taskDate > parseISO(toDate + 'T23:59:59')) return false;
          return true;
        });
      }

      // Build user map
      const userMap = new Map(members.map(m => [m.profile.user_id, m]));

      const exportData = filteredTasks.map(task => {
        const member = userMap.get(task.assigned_to);
        return {
          'User': member?.profile.full_name || 'Unknown',
          'Role': member?.role ? ROLE_LABELS[member.role] : '-',
          'Department': member?.profile.department || '-',
          'Task': task.title,
          'Date Completed': task.completed_at ? format(new Date(task.completed_at), 'yyyy-MM-dd') : '-',
          'Duration (min)': task.duration_minutes || '-',
          'Start Time': task.accepted_at ? format(new Date(task.accepted_at), 'HH:mm') : '-',
          'End Time': task.completed_at ? format(new Date(task.completed_at), 'HH:mm') : '-',
        };
      });

      if (exportData.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'No completed tasks in the selected range.' });
        setIsExporting(false);
        return;
      }

      const ws = XLSX.utils.json_to_sheet(exportData);
      if (exportData.length > 0) {
        const keys = Object.keys(exportData[0] || {});
        const colWidths = keys.map((key) => {
          let maxLen = key.length;
          exportData.forEach((row: any) => {
            const val = row[key];
            if (val !== undefined && val !== null) {
              const valStr = String(val);
              if (valStr.length > maxLen) maxLen = valStr.length;
            }
          });
          return { wch: Math.min(Math.max(maxLen + 4, 15), 45) };
        });
        ws['!cols'] = colWidths;
      }
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Team Task History');

      const dateRange = fromDate && toDate 
        ? `${fromDate}_to_${toDate}` 
        : fromDate 
          ? `from_${fromDate}` 
          : toDate 
            ? `to_${toDate}` 
            : 'full_history';

      const filename = `Krypton_Team_History_${dateRange}.${exportFormat}`;
      XLSX.writeFile(wb, filename);

      toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
      setShowExportDialog(false);
    } catch (error: any) {
      setExportError(error.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  // Filter members by search across member details, role, skill name, skill type, and skill domain
  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return members;

    return members.filter(m => {
      // 1. Member Name
      if (m.profile.full_name.toLowerCase().includes(query)) return true;

      // 2. Email
      if (m.profile.email.toLowerCase().includes(query)) return true;

      // 3. Department
      if (m.profile.department.toLowerCase().includes(query)) return true;

      // 4. Role
      if (m.role) {
        const roleLabel = ROLE_LABELS[m.role] || m.role;
        if (roleLabel.toLowerCase().includes(query)) return true;
      }

      // 5. Skills (Skill Name, Skill Type, Skill Domain)
      if (m.skills && m.skills.length > 0) {
        const matchesSkill = m.skills.some(skill => {
          // Skill name match
          if (skill.skill_name.toLowerCase().includes(query)) return true;

          // Skill type match
          if (skill.skill_type.toLowerCase().includes(query)) return true;
          const typeLabel = SKILL_TYPE_LABELS[skill.skill_type];
          if (typeLabel && typeLabel.toLowerCase().includes(query)) return true;

          // Skill domain match (effective domain, raw domain, formatted label, custom domain)
          const effectiveDomain = getEffectiveDomain(skill.skill_name, skill.domain, skill.custom_domain);
          if (effectiveDomain.toLowerCase().includes(query)) return true;
          if (skill.domain.toLowerCase().includes(query)) return true;
          const domainLabel = SKILL_DOMAIN_LABELS[skill.domain as SkillDomain];
          if (domainLabel && domainLabel.toLowerCase().includes(query)) return true;
          if (skill.custom_domain && skill.custom_domain.toLowerCase().includes(query)) return true;

          return false;
        });

        if (matchesSkill) return true;
      }

      // 6. Community Name Search
      if (m.communities && m.communities.some(c => c.toLowerCase().includes(query))) return true;

      return false;
    });
  }, [members, searchQuery]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const isPBL = mode === 'pbl';

  const teamDirectoryContent = (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Team Directory
          </h2>
          <RefreshButton onClick={handleManualRefresh} isRefreshing={isRefreshing} />
          <p className="text-muted-foreground mt-1 hidden sm:block">
            ({members.length} members)
          </p>
        </div>
        
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search members, skills, or domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[240px] sm:w-[320px]"
            />
          </div>
          
          {isLeadership && (
            <Button variant="outline" onClick={() => {
              setExportError(null);
              setShowExportDialog(true);
            }}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {isFetching ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading team members...
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? 'No members found matching your search.' : 'No team members found'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMembers.map((member) => (
            <KryptonIdCard
              key={member.profile.user_id}
              profile={member.profile}
              role={member.role}
              taskStats={member.taskStats}
              canEditPhone={isCaptainOrVice}
              onUpdatePhone={isCaptainOrVice ? (phone) => handleUpdatePhone(member.profile.user_id, phone) : undefined}
              onUpdateRegisterNumber={isCaptainOrVice ? (registerNumber) => handleUpdateRegisterNumber(member.profile.user_id, registerNumber) : undefined}
              onClick={() => {
                if (mode === 'grouping') {
                  if (member.profile.user_id === user.id) {
                    navigate('/grouping/me');
                  } else {
                    navigate(`/grouping/me?userId=${member.profile.user_id}`);
                  }
                  return;
                }
                if (member.profile.user_id === user.id) {
                  navigate('/my-space');
                } else if (isLeadership) {
                  navigate(`/member/${member.profile.user_id}`);
                } else {
                  navigate(`/profile/${member.profile.user_id}`);
                }
              }}
              onViewProfile={
                member.profile.user_id !== user.id
                  ? () => {
                      if (mode === 'grouping') {
                        navigate(`/grouping/me?userId=${member.profile.user_id}`);
                      } else {
                        navigate(isLeadership ? `/member/${member.profile.user_id}` : `/profile/${member.profile.user_id}`);
                      }
                    }
                  : undefined
              }
              showProfileIcon={member.profile.user_id !== user.id}
            />
          ))}
        </div>
      )}

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isGroupingMode ? (
                <>
                  <Target className="w-5 h-5" />
                  Export Grouping Session Report
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-5 h-5" />
                  Export Team Task History
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isGroupingMode 
                ? 'Export comprehensive team member information from the current active session.'
                : 'Export completed task history for all team members.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {isGroupingMode ? (
              <>
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <p className="text-sm font-medium">Export includes:</p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Member identity and role</li>
                    <li>Skills and skill domains</li>
                    <li>Leaderboard ranks and points</li>
                    <li>Current sprint/session details</li>
                    <li>Progress and target information</li>
                    <li>Completed and pending activity</li>
                    <li>Point summaries</li>
                    <li>Other My Space information</li>
                  </ul>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    <strong>Note:</strong> Data will be compiled across active session performance, skills, and leaderboard rankings.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Export completed task history for all team members.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>From Date</Label>
                    <Input 
                      type="date" 
                      value={fromDate}
                      onChange={(e) => { setFromDate(e.target.value); setExportError(null); }}
                      max={getTodayString()}
                    />
                  </div>
                  <div>
                    <Label>To Date</Label>
                    <Input 
                      type="date" 
                      value={toDate}
                      onChange={(e) => { setToDate(e.target.value); setExportError(null); }}
                      max={getTodayString()}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave dates empty for full history export.
                </p>
              </>
            )}
            
            {exportError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {exportError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => isGroupingMode ? handleGroupingExport('csv') : handlePBLExport('csv')}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'Download CSV'}
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => isGroupingMode ? handleGroupingExport('xlsx') : handlePBLExport('xlsx')}
                disabled={isExporting}
              >
                {isExporting ? 'Exporting...' : 'Download Excel'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  const content = teamDirectoryContent;

  if (isPBL) {
    return <PBLLayout title="Team Directory">{content}</PBLLayout>;
  }

  if (isGroupingMode) {
    return <GroupingLayout title="Team Directory">{content}</GroupingLayout>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-6">
        {content}
      </main>
    </div>
  );
};

export default Team;

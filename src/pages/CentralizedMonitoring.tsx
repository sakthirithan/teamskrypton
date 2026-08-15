import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCentralizedMonitoring, MemberMonitoringStatus } from '@/hooks/useCentralizedMonitoring';
import { MonitoringMemberCard } from '@/components/monitoring/MonitoringMemberCard';
import { MonitoringTargetConfigModal } from '@/components/monitoring/MonitoringTargetConfigModal';
import { LeadAlertModal } from '@/components/monitoring/LeadAlertModal';
import { DailySurveyModal } from '@/components/monitoring/DailySurveyModal';
import { ScheduleSurveyAlertModal } from '@/components/monitoring/ScheduleSurveyAlertModal';
import { DailySurveyCommandCenter } from '@/components/monitoring/DailySurveyCommandCenter';
import { MonitoringMemberDrawer } from '@/components/monitoring/MonitoringMemberDrawer';
import { MemberAlertPopover } from '@/components/monitoring/MemberAlertPopover';
import { AlertRulesPanel } from '@/components/monitoring/AlertRulesPanel';
import { MonitoringHistoryPanel } from '@/components/monitoring/MonitoringHistoryPanel';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Coins,
  Search,
  Target,
  Bell,
  FileCheck,
  Edit2,
  Check,
  X,
  RefreshCw,
  CheckSquare,
  LayoutGrid,
  List,
  Columns,
  Loader2,
  ClipboardList,
  LayoutDashboard,
  Clock,
  History,
  Send,
  ArrowUpRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function CentralizedMonitoringContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    targets,
    membersMonitoring,
    scheduledAlerts,
    auditLog,
    isLoading,
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
    setMemberSurveyCount,
    submitDailySurvey,
    sendLeadAlert,
    isLeadership,
    user,
    refetch,
  } = useCentralizedMonitoring();

  // Active Tab State
  const initialTab = searchParams.get('tab') || (searchParams.get('open') === 'survey' ? 'survey' : 'overview');
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Multi-Select Members State
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Member Drawer State
  const [selectedDrawerMember, setSelectedDrawerMember] = useState<MemberMonitoringStatus | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Modals state
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedAlertMemberId, setSelectedAlertMemberId] = useState<string | null>(null);
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);

  // Direct Inline Cell AP Editing State
  const [editingApUserId, setEditingApUserId] = useState<string | null>(null);
  const [apInputVal, setApInputVal] = useState('');
  const [isSavingInlineAp, setIsSavingInlineAp] = useState(false);

  useEffect(() => {
    if (searchParams.get('open') === 'survey') {
      setIsSurveyModalOpen(true);
    }
  }, [searchParams]);

  const currentUserMember = useMemo(() => {
    return membersMonitoring.find((m) => m.userId === user?.id) || null;
  }, [membersMonitoring, user?.id]);

  const handleOpenDrawer = (member: MemberMonitoringStatus) => {
    setSelectedDrawerMember(member);
    setIsDrawerOpen(true);
  };

  const handleStartInlineApEdit = (m: MemberMonitoringStatus) => {
    if (!isLeadership || isSavingInlineAp) return;
    setEditingApUserId(m.userId);
    setApInputVal(m.ap.achieved.toString());
  };

  const handleSaveInlineAp = async (userId: string, originalVal: number) => {
    if (isSavingInlineAp) return;

    const pts = parseInt(apInputVal, 10);
    if (isNaN(pts) || pts < 0) {
      setEditingApUserId(null);
      return;
    }

    if (pts === originalVal) {
      setEditingApUserId(null);
      return;
    }

    setIsSavingInlineAp(true);
    try {
      await updateMemberAP.mutateAsync({ userId, points: pts });
      setEditingApUserId(null);
    } catch {
      setApInputVal(originalVal.toString());
    } finally {
      setIsSavingInlineAp(false);
    }
  };

  // Extract unique departments
  const departments = useMemo(() => {
    const set = new Set<string>();
    membersMonitoring.forEach((m) => {
      if (m.department) set.add(m.department);
    });
    return Array.from(set);
  }, [membersMonitoring]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return membersMonitoring.filter((m) => {
      if (
        searchQuery &&
        !m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !m.department.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !m.email.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }

      if (statusFilter === 'completed' && !m.overallMet) return false;
      if (statusFilter === 'missing' && m.overallMet) return false;
      if (statusFilter === 'ap_missing' && m.ap.isMet) return false;
      if (statusFilter === 'ps_missing' && m.ps.isMet) return false;
      if (statusFilter === 'survey_missing' && m.dailySurvey.isMet) return false;

      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (departmentFilter !== 'all' && m.department !== departmentFilter) return false;

      return true;
    });
  }, [membersMonitoring, searchQuery, statusFilter, roleFilter, departmentFilter]);

  // Active Removable Filter Chips
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (statusFilter !== 'all') {
      chips.push({ key: 'status', label: `Filter: ${statusFilter.replace('_', ' ')}`, clear: () => setStatusFilter('all') });
    }
    if (roleFilter !== 'all') {
      chips.push({ key: 'role', label: `Role: ${roleFilter.replace('_', ' ')}`, clear: () => setRoleFilter('all') });
    }
    if (departmentFilter !== 'all') {
      chips.push({ key: 'dept', label: `Dept: ${departmentFilter}`, clear: () => setDepartmentFilter('all') });
    }
    if (searchQuery) {
      chips.push({ key: 'search', label: `Search: "${searchQuery}"`, clear: () => setSearchQuery('') });
    }
    return chips;
  }, [statusFilter, roleFilter, departmentFilter, searchQuery]);

  // Multi-Select Handlers
  const isAllSelected = filteredMembers.length > 0 && filteredMembers.every((m) => selectedMemberIds.includes(m.userId));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(filteredMembers.map((m) => m.userId));
    }
  };

  const handleToggleSelectMember = (userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const activeBulkUserIds = selectedMemberIds.length > 0 ? selectedMemberIds : filteredMembers.map((m) => m.userId);

  // Bulk Actions (Leadership)
  const handleBulkAp = async (deltaPoints: number) => {
    if (activeBulkUserIds.length === 0) return;
    await bulkUpdateMembers.mutateAsync({ userIds: activeBulkUserIds, field: 'ap', value: deltaPoints });
  };

  const handleBulkPs = async (status: 'completed' | 'pending') => {
    if (activeBulkUserIds.length === 0) return;
    await bulkUpdateMembers.mutateAsync({ userIds: activeBulkUserIds, field: 'ps', value: status });
  };

  const handleBulkSurvey = async (count: number) => {
    if (activeBulkUserIds.length === 0) return;
    await bulkUpdateMembers.mutateAsync({ userIds: activeBulkUserIds, field: 'survey', value: count });
  };

  // KPI Statistics (Group Meeting Completely Excluded)
  const totalCount = membersMonitoring.length;
  const metCount = membersMonitoring.filter((m) => m.overallMet).length;
  const missingCount = totalCount - metCount;
  const teamCompletionPct = totalCount > 0 ? Math.round((metCount / totalCount) * 100) : 0;
  const avgApPct =
    totalCount > 0
      ? Math.round(membersMonitoring.reduce((sum, m) => sum + m.ap.percentage, 0) / totalCount)
      : 0;

  const psMetCount = membersMonitoring.filter((m) => m.ps.isMet).length;
  const surveyMetCount = membersMonitoring.filter((m) => m.dailySurvey.isMet).length;

  // Needs Attention List (Sorted by missing criteria count descending)
  const needsAttentionList = useMemo(() => {
    return membersMonitoring
      .filter((m) => !m.overallMet)
      .map((m) => {
        let count = 0;
        if (!m.ap.isMet) count++;
        if (!m.ps.isMet) count++;
        if (!m.dailySurvey.isMet) count++;
        return { member: m, missingCount: count };
      })
      .sort((a, b) => b.missingCount - a.missingCount);
  }, [membersMonitoring]);

  const handleOpenSingleAlert = (userId: string) => {
    setSelectedAlertMemberId(userId);
    setIsAlertModalOpen(true);
  };

  const toggleKpiFilter = (targetFilter: string) => {
    if (statusFilter === targetFilter) {
      setStatusFilter('all');
    } else {
      setStatusFilter(targetFilter);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-4.5rem)] overflow-hidden text-xs">
      {/* ── PINNED TOP HEADER & WORKSPACE NAVIGATION ── */}
      <div className="shrink-0 space-y-3 p-3 bg-card border-b shadow-xs z-30">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-foreground">Monitoring &amp; Alerts</h1>
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-mono font-bold text-[11px]">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <span className="hidden lg:inline text-[11px] text-muted-foreground font-mono">
              Updated {formatDistanceToNow(lastSyncTime, { addSuffix: true })}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSurveyModalOpen(true)}
              className="h-8 px-3 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xs border-none"
            >
              <FileCheck className="w-3.5 h-3.5" /> Take Survey
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-8 px-2.5 text-xs gap-1 font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>

            {isLeadership && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConfigModalOpen(true)}
                  className="h-8 px-2.5 text-xs gap-1 font-bold border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Target className="w-3.5 h-3.5" /> Targets
                </Button>

                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedAlertMemberId(null);
                    setIsAlertModalOpen(true);
                  }}
                  className="h-8 px-3 text-xs gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold shadow-xs"
                >
                  <Bell className="w-3.5 h-3.5" /> Send Alert
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Workspace Navigation Tabs & View Switcher */}
        <div className="flex items-center justify-between gap-2 border-t pt-2 overflow-x-auto scrollbar-none">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="w-full">
            <div className="flex items-center justify-between gap-2">
              <TabsList className="h-8 bg-muted/60 p-0.5 rounded-lg">
                <TabsTrigger value="overview" className="h-7 text-xs px-3 font-bold gap-1.5">
                  <LayoutDashboard className="w-3.5 h-3.5" /> Overview
                </TabsTrigger>
                <TabsTrigger value="members" className="h-7 text-xs px-3 font-bold gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Members ({totalCount})
                </TabsTrigger>
                <TabsTrigger value="alerts" className="h-7 text-xs px-3 font-bold gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-amber-500" /> Alerts &amp; Rules
                </TabsTrigger>
                <TabsTrigger value="survey" className="h-7 text-xs px-3 font-bold gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-purple-400" /> Daily Survey
                </TabsTrigger>
                <TabsTrigger value="history" className="h-7 text-xs px-3 font-bold gap-1.5">
                  <History className="w-3.5 h-3.5" /> History
                </TabsTrigger>
              </TabsList>

              {/* View Switcher for Members Tab */}
              {activeTab === 'members' && (
                <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/50 shrink-0">
                  <button
                    onClick={() => setViewMode('detailed')}
                    title="Compact Table View"
                    className={`p-1.5 rounded transition-all ${
                      viewMode === 'detailed' ? 'bg-background text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('compact')}
                    title="Compact List View"
                    className={`p-1.5 rounded transition-all ${
                      viewMode === 'compact' ? 'bg-background text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    title="Member Cards View"
                    className={`p-1.5 rounded transition-all ${
                      viewMode === 'grid' ? 'bg-background text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </Tabs>
        </div>

        {/* High-Density Interactive KPI Filter Chips (Group Meeting Removed!) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <div
            onClick={() => toggleKpiFilter('all')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 font-medium ${
              statusFilter === 'all' ? 'bg-primary/15 border-primary text-primary font-bold shadow-xs' : 'bg-card border-border/60 hover:bg-muted/50'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>Eligible: <strong className="text-foreground">{totalCount}</strong></span>
          </div>

          <div
            onClick={() => toggleKpiFilter('completed')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 font-medium ${
              statusFilter === 'completed' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500 font-bold shadow-xs' : 'bg-card border-border/60 hover:bg-muted/50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Completed: <strong className="text-emerald-500 dark:text-emerald-400">{metCount}</strong></span>
          </div>

          <div
            onClick={() => toggleKpiFilter('missing')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 font-medium ${
              statusFilter === 'missing' ? 'bg-amber-500/20 border-amber-500 text-amber-500 font-bold shadow-xs' : 'bg-card border-border/60 hover:bg-muted/50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>Missing: <strong className="text-amber-500 dark:text-amber-400">{missingCount}</strong></span>
          </div>

          <div
            onClick={() => toggleKpiFilter('ap_missing')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 font-medium ${
              statusFilter === 'ap_missing' ? 'bg-amber-500/20 border-amber-500 text-amber-500 font-bold shadow-xs' : 'bg-card border-border/60 hover:bg-muted/50'
            }`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span>AP Progress: <strong className="text-amber-400">{avgApPct}%</strong></span>
          </div>

          <div
            onClick={() => toggleKpiFilter('ps_missing')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 font-medium ${
              statusFilter === 'ps_missing' ? 'bg-blue-500/20 border-blue-500 text-blue-500 font-bold shadow-xs' : 'bg-card border-border/60 hover:bg-muted/50'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
            <span>PS Met: <strong className="text-foreground">{psMetCount}/{totalCount}</strong></span>
          </div>

          <div
            onClick={() => toggleKpiFilter('survey_missing')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 font-medium ${
              statusFilter === 'survey_missing' ? 'bg-purple-500/20 border-purple-500 text-purple-500 font-bold shadow-xs' : 'bg-card border-border/60 hover:bg-muted/50'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>Survey Target Met: <strong className="text-foreground">{surveyMetCount}/{totalCount}</strong></span>
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE TAB CONTENT REGION ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-4">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Overall Team Completion Ring Card */}
              <Card className="p-4 bg-card border flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Overall Compliance</h3>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-extrabold font-mono text-emerald-500">{teamCompletionPct}%</span>
                    <span className="text-xs text-muted-foreground">({metCount} of {totalCount} completed)</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${teamCompletionPct}%` }} />
                </div>
              </Card>

              {/* Current Requirement Gaps */}
              <Card className="p-4 bg-card border space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Current Requirement Gaps</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1"><Coins className="w-3.5 h-3.5 text-amber-500" /> AP Missing:</span>
                    <strong className="text-amber-500 font-mono">{totalCount - membersMonitoring.filter(m => m.ap.isMet).length}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5 text-blue-500" /> PS Missing:</span>
                    <strong className="text-blue-500 font-mono">{totalCount - psMetCount}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground flex items-center gap-1"><FileCheck className="w-3.5 h-3.5 text-purple-400" /> Survey Missing:</span>
                    <strong className="text-purple-400 font-mono">{totalCount - surveyMetCount}</strong>
                  </div>
                </div>
              </Card>

              {/* Quick Actions */}
              <Card className="p-4 bg-card border space-y-2.5 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Quick Actions</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Submit Take Survey or alert members with missing requirements.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white gap-1"
                    onClick={() => setIsSurveyModalOpen(true)}
                  >
                    <FileCheck className="w-3.5 h-3.5" /> Take Survey
                  </Button>
                  {isLeadership && (
                    <Button
                      size="sm"
                      className="flex-1 h-8 text-xs font-bold bg-gradient-to-r from-amber-600 to-orange-600 text-white gap-1"
                      onClick={() => {
                        setSelectedAlertMemberId(null);
                        setIsAlertModalOpen(true);
                      }}
                    >
                      <Bell className="w-3.5 h-3.5" /> Nudge ({missingCount})
                    </Button>
                  )}
                </div>
              </Card>
            </div>

            {/* Needs Attention Shortlist */}
            <Card className="p-4 bg-card border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Needs Attention List ({needsAttentionList.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">Members with missing daily requirements prioritized by severity.</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary" onClick={() => setActiveTab('members')}>
                  View All Matrix <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>

              {needsAttentionList.length === 0 ? (
                <div className="p-6 text-center text-xs text-emerald-500 font-bold border border-dashed rounded-xl">
                  🎉 Great job! All members have completed their daily requirements.
                </div>
              ) : (
                <div className="divide-y divide-border/50 border rounded-xl overflow-hidden">
                  {needsAttentionList.slice(0, 15).map(({ member: m }) => (
                    <div
                      key={m.userId}
                      onClick={() => handleOpenDrawer(m)}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-primary/20">
                          <AvatarImage src={m.avatarUrl || ''} alt={m.fullName} />
                          <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                            {m.fullName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-xs text-foreground">{m.fullName}</p>
                            <Badge variant="outline" className="text-[9px] capitalize px-1 py-0">
                              {m.role.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            {!m.ap.isMet && <span className="text-amber-500 font-semibold">• AP: {m.ap.achieved}/{m.ap.target}</span>}
                            {!m.ps.isMet && <span className="text-blue-500 font-semibold">• PS Pending</span>}
                            {!m.dailySurvey.isMet && <span className="text-purple-400 font-semibold">• Survey: {m.dailySurvey.achieved}/{m.dailySurvey.target}</span>}
                          </div>
                        </div>
                      </div>

                      {isLeadership && (
                        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <MemberAlertPopover member={m} isLeadership={isLeadership} onSendAlert={sendLeadAlert.mutateAsync} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 2: MEMBERS MATRIX */}
        {activeTab === 'members' && (
          <div className="space-y-3">
            {/* Filter Toolbar */}
            <Card className="p-3 bg-card border shadow-xs space-y-2">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Search member, email, department..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs bg-background/80"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 text-xs bg-background/80 w-36">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="completed">✓ Criteria Met</SelectItem>
                      <SelectItem value="missing">! Missing Requirements</SelectItem>
                      <SelectItem value="ap_missing">AP Missing</SelectItem>
                      <SelectItem value="ps_missing">PS Missing</SelectItem>
                      <SelectItem value="survey_missing">Survey Missing</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-8 text-xs bg-background/80 w-32">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="team_captain">Captain</SelectItem>
                      <SelectItem value="vice_captain">Vice Captain</SelectItem>
                      <SelectItem value="strategist">Strategist</SelectItem>
                      <SelectItem value="team_manager">Manager</SelectItem>
                      <SelectItem value="team_member">Member</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="h-8 text-xs bg-background/80 w-36">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Depts</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active Removable Filter Chips */}
              {activeChips.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-border/40 text-[11px]">
                  <span className="font-bold text-muted-foreground uppercase text-[10px]">Active Filters:</span>
                  {activeChips.map((chip) => (
                    <Badge
                      key={chip.key}
                      variant="secondary"
                      className="gap-1 font-semibold text-[11px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 cursor-pointer hover:bg-purple-500/20"
                      onClick={chip.clear}
                    >
                      {chip.label}
                      <X className="w-3 h-3 hover:text-white" />
                    </Badge>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setStatusFilter('all');
                      setRoleFilter('all');
                      setDepartmentFilter('all');
                      setSearchQuery('');
                    }}
                  >
                    Clear All
                  </Button>
                </div>
              )}
            </Card>

            {/* Matrix View Content */}
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse border" />
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <Card className="p-8 text-center space-y-2 bg-card border">
                <Users className="w-8 h-8 mx-auto text-muted-foreground/40" />
                <h3 className="text-sm font-bold text-foreground">No Members Found</h3>
                <p className="text-xs text-muted-foreground">No members matched your search or filter requirements.</p>
              </Card>
            ) : (
              <>
                {/* VIEW MODE 1: COMPACT MATRIX TABLE */}
                {viewMode === 'detailed' && (
                  <div className="border rounded-xl overflow-hidden bg-card shadow-xs">
                    <div className="overflow-x-auto max-h-[580px]">
                      <Table className="relative w-full">
                        <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-20 border-b border-border/80 shadow-xs">
                          <TableRow className="hover:bg-transparent">
                            {isLeadership && (
                              <TableHead className="w-10 py-2.5">
                                <Checkbox checked={isAllSelected} onCheckedChange={handleToggleSelectAll} />
                              </TableHead>
                            )}
                            <TableHead className="font-bold text-xs uppercase py-2.5">Member</TableHead>
                            <TableHead className="font-bold text-xs uppercase py-2.5">Role</TableHead>
                            <TableHead className="py-2.5">AP Points</TableHead>
                            <TableHead className="py-2.5">Minimum PS</TableHead>
                            <TableHead className="py-2.5">Daily Survey</TableHead>
                            <TableHead className="font-bold text-xs uppercase py-2.5">Overall</TableHead>
                            {isLeadership && <TableHead className="text-right font-bold text-xs uppercase py-2.5">Alert 🔔</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredMembers.map((m) => {
                            const isSelected = selectedMemberIds.includes(m.userId);
                            const isEditingThisAp = editingApUserId === m.userId;

                            return (
                              <TableRow
                                key={m.userId}
                                onClick={() => handleOpenDrawer(m)}
                                className={`transition-colors py-1.5 cursor-pointer ${
                                  isSelected ? 'bg-primary/10' : m.overallMet ? 'hover:bg-emerald-500/5' : 'bg-amber-500/5 hover:bg-amber-500/10'
                                }`}
                              >
                                {isLeadership && (
                                  <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                    <Checkbox checked={isSelected} onCheckedChange={() => handleToggleSelectMember(m.userId)} />
                                  </TableCell>
                                )}

                                <TableCell className="py-2 font-medium">
                                  <div className="flex items-center gap-2.5">
                                    <Avatar className="h-8 w-8 border border-primary/20">
                                      <AvatarImage src={m.avatarUrl || ''} alt={m.fullName} />
                                      <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                                        {m.fullName.slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-bold text-xs text-foreground leading-tight">{m.fullName}</p>
                                      <p className="text-[10px] text-muted-foreground font-medium leading-tight">{m.department}</p>
                                    </div>
                                  </div>
                                </TableCell>

                                <TableCell className="py-2">
                                  <Badge variant="outline" className="capitalize text-[10px] font-semibold bg-muted/40 border-primary/20 px-1.5 py-0">
                                    {m.role.replace('_', ' ')}
                                  </Badge>
                                </TableCell>

                                {/* Direct AP Cell Inline Edit (Leadership Only) */}
                                <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                  {isLeadership && isEditingThisAp ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        min="0"
                                        value={apInputVal}
                                        onChange={(e) => setApInputVal(e.target.value)}
                                        onFocus={(e) => e.target.select()}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveInlineAp(m.userId, m.ap.achieved);
                                          if (e.key === 'Escape') setEditingApUserId(null);
                                        }}
                                        onBlur={() => handleSaveInlineAp(m.userId, m.ap.achieved)}
                                        disabled={isSavingInlineAp}
                                        className="h-7 w-24 text-xs font-extrabold font-mono bg-background border-amber-500 px-1.5"
                                        autoFocus
                                      />
                                      {isSavingInlineAp ? (
                                        <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin shrink-0" />
                                      ) : (
                                        <Button size="icon" className="h-7 w-7 bg-amber-600 hover:bg-amber-700 shrink-0" onClick={() => handleSaveInlineAp(m.userId, m.ap.achieved)}>
                                          <Check className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => handleStartInlineApEdit(m)}
                                      className={`group ${isLeadership ? 'cursor-pointer hover:bg-amber-500/10 px-1.5 py-0.5 rounded border border-transparent hover:border-amber-500/30' : ''}`}
                                    >
                                      <div className="flex items-center gap-1">
                                        <p className="font-extrabold text-xs text-foreground font-mono">
                                          {m.ap.achieved.toLocaleString()} / {m.ap.target.toLocaleString()}
                                        </p>
                                        {isLeadership && <Edit2 className="w-3 h-3 text-amber-500 opacity-60 group-hover:opacity-100" />}
                                      </div>
                                    </div>
                                  )}
                                </TableCell>

                                {/* PS Column Badge */}
                                <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                  <Badge
                                    variant="outline"
                                    onClick={async () => {
                                      if (isLeadership) {
                                        await setMemberPsStatus.mutateAsync({
                                          userId: m.userId,
                                          newStatus: m.ps.isMet ? 'pending' : 'completed',
                                          count: m.ps.target,
                                        });
                                      }
                                    }}
                                    className={`text-[10px] font-bold px-2 py-0.5 ${isLeadership ? 'cursor-pointer hover:opacity-80' : ''} ${
                                      m.ps.isMet ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-amber-500/20 border-amber-500 text-amber-500'
                                    }`}
                                  >
                                    {m.ps.isMet ? '✓ Completed' : 'Not Yet'}
                                  </Badge>
                                </TableCell>

                                {/* Daily Survey Count-Based Column with Lead Stepper [-] [+] */}
                                <TableCell className="py-2 font-mono font-bold text-xs" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center gap-1.5">
                                    {isLeadership && (
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-5 w-5 text-xs font-bold border-purple-500/40 text-purple-400 hover:bg-purple-500/10 shrink-0"
                                        onClick={async () => {
                                          await setMemberSurveyCount.mutateAsync({
                                            userId: m.userId,
                                            count: Math.max(0, m.dailySurvey.achieved - 1),
                                          });
                                        }}
                                        title="Decrement survey count"
                                      >
                                        −
                                      </Button>
                                    )}
                                    <span className={m.dailySurvey.isMet ? 'text-emerald-500' : 'text-purple-400'}>
                                      {m.dailySurvey.achieved} / {m.dailySurvey.target}
                                    </span>
                                    {isLeadership && (
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-5 w-5 text-xs font-bold border-purple-500/40 text-purple-400 hover:bg-purple-500/10 shrink-0"
                                        onClick={async () => {
                                          await setMemberSurveyCount.mutateAsync({
                                            userId: m.userId,
                                            count: m.dailySurvey.achieved + 1,
                                          });
                                        }}
                                        title="Increment survey count"
                                      >
                                        +
                                      </Button>
                                    )}
                                    <div className="h-1.5 w-12 bg-muted/60 rounded-full overflow-hidden shrink-0 hidden sm:block">
                                      <div
                                        className={`h-full ${m.dailySurvey.isMet ? 'bg-emerald-400' : 'bg-purple-400'}`}
                                        style={{ width: `${Math.min(100, m.dailySurvey.percentage)}%` }}
                                      />
                                    </div>
                                  </div>
                                </TableCell>

                                <TableCell className="py-2">
                                  <Badge
                                    variant={m.overallMet ? 'default' : 'destructive'}
                                    className={`text-[10px] font-bold px-2 py-0.5 ${m.overallMet ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}
                                  >
                                    {m.overallMet ? '✓ Met' : '! Missing'}
                                  </Badge>
                                </TableCell>

                                {isLeadership && (
                                  <TableCell className="text-right py-2" onClick={(e) => e.stopPropagation()}>
                                    <MemberAlertPopover member={m} isLeadership={isLeadership} onSendAlert={sendLeadAlert.mutateAsync} />
                                  </TableCell>
                                )}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* VIEW MODE 2: COMPACT LIST VIEW */}
                {viewMode === 'compact' && (
                  <div className="space-y-1.5">
                    {filteredMembers.map((m) => (
                      <div
                        key={m.userId}
                        onClick={() => handleOpenDrawer(m)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                          selectedMemberIds.includes(m.userId) ? 'bg-primary/10 border-primary' : m.overallMet ? 'bg-card border-emerald-500/30' : 'bg-card border-amber-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {isLeadership && (
                            <Checkbox
                              checked={selectedMemberIds.includes(m.userId)}
                              onCheckedChange={() => handleToggleSelectMember(m.userId)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                          <Avatar className="h-8 w-8 border border-primary/20">
                            <AvatarImage src={m.avatarUrl || ''} alt={m.fullName} />
                            <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                              {m.fullName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-xs text-foreground leading-tight">{m.fullName}</p>
                              <Badge variant="outline" className="text-[9px] capitalize px-1 py-0">
                                {m.role.replace('_', ' ')}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium">{m.department}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                          <span className="px-2 py-0.5 rounded border text-[11px] font-bold font-mono bg-amber-500/10 text-amber-400 border-amber-500/30">
                            AP: {m.ap.achieved} / {m.ap.target}
                          </span>

                          <Badge
                            variant="outline"
                            onClick={async () => {
                              if (isLeadership) {
                                await setMemberPsStatus.mutateAsync({
                                  userId: m.userId,
                                  newStatus: m.ps.isMet ? 'pending' : 'completed',
                                  count: m.ps.target,
                                });
                              }
                            }}
                            className={`text-[10px] font-bold px-2 py-0.5 ${isLeadership ? 'cursor-pointer hover:opacity-80' : ''} ${
                              m.ps.isMet ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' : 'bg-amber-500/20 border-amber-500 text-amber-500'
                            }`}
                          >
                            PS: {m.ps.isMet ? '✓ Completed' : 'Not Yet'}
                          </Badge>

                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-bold font-mono bg-purple-500/10 text-purple-400 border-purple-500/30">
                            <span>Survey:</span>
                            {isLeadership && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-4 w-4 text-[10px] font-bold border-purple-500/40 text-purple-400 hover:bg-purple-500/10 shrink-0"
                                onClick={async () => {
                                  await setMemberSurveyCount.mutateAsync({
                                    userId: m.userId,
                                    count: Math.max(0, m.dailySurvey.achieved - 1),
                                  });
                                }}
                              >
                                −
                              </Button>
                            )}
                            <span>{m.dailySurvey.achieved} / {m.dailySurvey.target}</span>
                            {isLeadership && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-4 w-4 text-[10px] font-bold border-purple-500/40 text-purple-400 hover:bg-purple-500/10 shrink-0"
                                onClick={async () => {
                                  await setMemberSurveyCount.mutateAsync({
                                    userId: m.userId,
                                    count: m.dailySurvey.achieved + 1,
                                  });
                                }}
                              >
                                +
                              </Button>
                            )}
                          </div>

                          <Badge
                            variant={m.overallMet ? 'default' : 'destructive'}
                            className={`text-[10px] font-bold px-2 py-0.5 ${m.overallMet ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}
                          >
                            {m.overallMet ? '✓ Met' : '! Missing'}
                          </Badge>

                          {isLeadership && (
                            <MemberAlertPopover member={m} isLeadership={isLeadership} onSendAlert={sendLeadAlert.mutateAsync} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* VIEW MODE 3: MEMBER CARDS VIEW */}
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredMembers.map((m) => (
                      <MonitoringMemberCard
                        key={m.userId}
                        member={m}
                        isLeadership={isLeadership}
                        isSelected={selectedMemberIds.includes(m.userId)}
                        onToggleSelect={handleToggleSelectMember}
                        onUpdateAp={async ({ userId, points }) => {
                          await updateMemberAP.mutateAsync({ userId, points });
                        }}
                        onSetPsStatus={async ({ userId, newStatus, count }) => {
                          await setMemberPsStatus.mutateAsync({ userId, newStatus, count });
                        }}
                        onSetSurveyCount={async ({ userId, count }) => {
                          await setMemberSurveyCount.mutateAsync({ userId, count });
                        }}
                        onSendAlert={sendLeadAlert.mutateAsync}
                        onOpenDrawer={handleOpenDrawer}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 3: ALERTS & AUTOMATION */}
        {activeTab === 'alerts' && (
          <AlertRulesPanel
            scheduledAlerts={scheduledAlerts}
            members={membersMonitoring}
            onCancelScheduledAlert={async (id) => {
              await cancelScheduledAlert.mutateAsync(id);
            }}
            onOpenSendAlertModal={() => setIsAlertModalOpen(true)}
          />
        )}

        {/* TAB 4: DAILY SURVEY COMMAND CENTER */}
        {activeTab === 'survey' && (
          <DailySurveyCommandCenter
            members={membersMonitoring}
            scheduledAlerts={scheduledAlerts}
            isLeadership={isLeadership}
            onOpenSurveyModal={() => setIsSurveyModalOpen(true)}
            onSendSurveyPrompt={async () => {
              await sendDailySurveyActionablePrompt.mutateAsync();
            }}
            onOpenScheduleModal={() => setIsScheduleModalOpen(true)}
            onCancelScheduledAlert={async (id) => {
              await cancelScheduledAlert.mutateAsync(id);
            }}
          />
        )}

        {/* TAB 5: HISTORY & AUDIT LOG */}
        {activeTab === 'history' && (
          <MonitoringHistoryPanel auditLog={auditLog} members={membersMonitoring} />
        )}
      </div>

      {/* FLOATING COMPACT BOTTOM ACTION BAR */}
      {isLeadership && selectedMemberIds.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 border border-purple-500/50 backdrop-blur-xl shadow-2xl rounded-2xl px-4 py-2 text-white flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-1.5 font-bold text-xs text-purple-400 border-r border-slate-800 pr-3">
            <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
            <span>{selectedMemberIds.length} Selected</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              size="sm"
              className="h-7 px-2.5 text-[11px] font-bold bg-gradient-to-r from-amber-600 to-orange-600 text-white gap-1"
              onClick={() => setIsAlertModalOpen(true)}
            >
              <Bell className="w-3 h-3" /> Send Alert
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-[11px] font-bold bg-purple-500/10 text-purple-300 border-purple-500/30 hover:bg-purple-500/20 gap-1"
              onClick={() => setIsScheduleModalOpen(true)}
            >
              <Clock className="w-3 h-3" /> Schedule
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-[11px] font-bold bg-blue-500/10 text-blue-300 border-blue-500/30 hover:bg-blue-500/20 gap-1"
              onClick={() => setActiveTab('alerts')}
            >
              <Target className="w-3 h-3" /> Automation
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px] text-slate-400 hover:text-white"
              onClick={() => setSelectedMemberIds([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Member Drawer */}
      <MonitoringMemberDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        member={selectedDrawerMember}
        isLeadership={isLeadership}
        onUpdateAp={async ({ userId, points }) => {
          await updateMemberAP.mutateAsync({ userId, points });
        }}
        onSaveIndividualTargets={async (params) => {
          await updateIndividualTargets.mutateAsync(params);
        }}
        onOpenAlertModal={handleOpenSingleAlert}
        onSendSurveyPrompt={async (userId) => {
          await sendDailySurveyActionablePrompt.mutateAsync(userId);
        }}
      />

      {/* Modals */}
      <MonitoringTargetConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        targets={targets}
        members={membersMonitoring}
        onSaveGlobalTargets={async (newTargets) => {
          await updateTargets.mutateAsync(newTargets);
        }}
        onSaveIndividualTargets={async (params) => {
          await updateIndividualTargets.mutateAsync(params);
        }}
      />

      <LeadAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        members={membersMonitoring}
        initialSelectedMemberId={selectedAlertMemberId}
        onSendAlert={async (params) => {
          await sendLeadAlert.mutateAsync(params);
        }}
      />

      <ScheduleSurveyAlertModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        members={membersMonitoring}
        initialSelectedMemberIds={selectedMemberIds}
        onScheduleAlert={async (params) => {
          await createScheduledAlert.mutateAsync(params);
        }}
      />

      <DailySurveyModal
        isOpen={isSurveyModalOpen}
        onClose={() => setIsSurveyModalOpen(false)}
        surveyTarget={currentUserMember?.dailySurvey.target ?? targets.required_survey_target}
        currentSurveyCount={currentUserMember?.dailySurvey.achieved ?? 0}
        currentPsCompleted={currentUserMember?.ps.isMet ?? false}
        onSubmitSurvey={async (params) => {
          await submitDailySurvey.mutateAsync(params);
        }}
      />
    </div>
  );
}

export default function CentralizedMonitoring() {
  return (
    <GroupingLayout title="Centralized Monitoring & Alerts">
      <CentralizedMonitoringContent />
    </GroupingLayout>
  );
}

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { TwoStatusButtons } from '@/components/monitoring/TwoStatusButtons';
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
  CalendarCheck,
  ClipboardList,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function CentralizedMonitoringContent() {
  const [searchParams] = useSearchParams();
  const {
    targets,
    membersMonitoring,
    scheduledAlerts,
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
    setMemberMeetingStatus,
    setMemberSurveyCount,
    submitDailySurvey,
    sendLeadAlert,
    isLeadership,
    refetch,
  } = useCentralizedMonitoring();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // Multi-Select Members State
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

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
      if (statusFilter === 'meeting_missing' && m.groupMeeting.isMet) return false;

      if (roleFilter !== 'all' && m.role !== roleFilter) return false;
      if (departmentFilter !== 'all' && m.department !== departmentFilter) return false;

      return true;
    });
  }, [membersMonitoring, searchQuery, statusFilter, roleFilter, departmentFilter]);

  // Removable Filter Chips
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

  // Bulk Actions
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

  const handleBulkMeeting = async (status: 'completed' | 'pending') => {
    if (activeBulkUserIds.length === 0) return;
    await bulkUpdateMembers.mutateAsync({ userIds: activeBulkUserIds, field: 'meeting', value: status });
  };

  // KPI Statistics
  const totalCount = membersMonitoring.length;
  const metCount = membersMonitoring.filter((m) => m.overallMet).length;
  const missingCount = totalCount - metCount;
  const avgApPct =
    totalCount > 0
      ? Math.round(membersMonitoring.reduce((sum, m) => sum + m.ap.percentage, 0) / totalCount)
      : 0;

  const psMetCount = membersMonitoring.filter((m) => m.ps.isMet).length;
  const surveyMetCount = membersMonitoring.filter((m) => m.dailySurvey.isMet).length;
  const meetingMetCount = membersMonitoring.filter((m) => m.groupMeeting.isMet).length;

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
    <div className="space-y-4 pb-20 relative text-xs">
      {/* Top Section 1: Compact Single-Line Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-card border shadow-sm">
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
          {/* Adaptive View Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-muted/60 border border-border/50">
            <button
              onClick={() => setViewMode('detailed')}
              title="Matrix Table View"
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
              title="Grid Cards View"
              className={`p-1.5 rounded transition-all ${
                viewMode === 'grid' ? 'bg-background text-foreground shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

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
                className="h-8 px-3 text-xs gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold shadow-sm"
              >
                <Bell className="w-3.5 h-3.5" /> Send Alert
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Top Section 2: High-Density Interactive KPI Filter Chips (Daily Survey Placed Next to PS!) */}
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
          <span>PS: <strong className="text-foreground">{psMetCount}/{totalCount}</strong></span>
        </div>

        {/* Daily Survey Chip (Placed Next to PS!) */}
        <div
          onClick={() => toggleKpiFilter('survey_missing')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 font-medium ${
            statusFilter === 'survey_missing' ? 'bg-purple-500/20 border-purple-500 text-purple-500 font-bold shadow-xs' : 'bg-card border-border/60 hover:bg-muted/50'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5 text-purple-400" />
          <span>Survey: <strong className="text-foreground">{surveyMetCount}/{totalCount}</strong></span>
        </div>

        <div
          onClick={() => toggleKpiFilter('meeting_missing')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shrink-0 font-medium ${
            statusFilter === 'meeting_missing' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500 font-bold shadow-xs' : 'bg-card border-border/60 hover:bg-muted/50'
          }`}
        >
          <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Meeting: <strong className="text-foreground">{meetingMetCount}/{totalCount}</strong></span>
        </div>
      </div>

      {/* Daily Survey Command Center Section */}
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

      {/* Single Compact Filter Toolbar */}
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
                <SelectItem value="meeting_missing">Meeting Missing</SelectItem>
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

      {/* Main Content Area: Desktop Table or Mobile Cards */}
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
          {/* VIEW MODE 1: HIGH-DENSITY DETAILED MATRIX TABLE (DESKTOP MAIN UI) */}
          {viewMode === 'detailed' && (
            <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
              <div className="overflow-x-auto max-h-[620px]">
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

                      {/* AP Column Header */}
                      <TableHead className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs uppercase">Activity Points (AP)</span>
                          {isLeadership && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-5 px-1.5 text-[9px] font-bold border-amber-400/40 text-amber-500 hover:bg-amber-500/10"
                              onClick={() => handleBulkAp(100)}
                              disabled={bulkUpdateMembers.isPending || activeBulkUserIds.length === 0}
                              title="Add +100 AP to target members"
                            >
                              +100
                            </Button>
                          )}
                        </div>
                      </TableHead>

                      {/* PS Entry Column Header */}
                      <TableHead className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs uppercase">PS Entry</span>
                          {isLeadership && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                className="h-5 px-1.5 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleBulkPs('completed')}
                                disabled={bulkUpdateMembers.isPending || activeBulkUserIds.length === 0}
                                title="Mark PS Done (0 pts)"
                              >
                                ✓ All
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5 px-1.5 text-[9px] font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                                onClick={() => handleBulkPs('pending')}
                                disabled={bulkUpdateMembers.isPending || activeBulkUserIds.length === 0}
                                title="Mark PS Pending"
                              >
                                ↻ All
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableHead>

                      {/* Daily Survey Column Header (MOVED DIRECTLY NEXT TO PS ENTRY!) */}
                      <TableHead className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs uppercase text-purple-400">Daily Survey</span>
                          {isLeadership && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                className="h-5 px-1.5 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleBulkSurvey(4)}
                                disabled={bulkUpdateMembers.isPending || activeBulkUserIds.length === 0}
                                title="Set Survey to 4"
                              >
                                ✓ 4
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5 px-1.5 text-[9px] font-bold border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
                                onClick={() => handleBulkSurvey(0)}
                                disabled={bulkUpdateMembers.isPending || activeBulkUserIds.length === 0}
                                title="Reset Survey to 0"
                              >
                                ↻ 0
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableHead>

                      {/* Group Meeting Column Header */}
                      <TableHead className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs uppercase">Meeting</span>
                          {isLeadership && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                className="h-5 px-1.5 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleBulkMeeting('completed')}
                                disabled={bulkUpdateMembers.isPending || activeBulkUserIds.length === 0}
                                title="Mark Meeting Met"
                              >
                                ✓ All
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-5 px-1.5 text-[9px] font-bold border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                                onClick={() => handleBulkMeeting('pending')}
                                disabled={bulkUpdateMembers.isPending || activeBulkUserIds.length === 0}
                                title="Mark Meeting Pending"
                              >
                                ↻ All
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableHead>

                      <TableHead className="font-bold text-xs uppercase py-2.5">Status</TableHead>
                      {isLeadership && <TableHead className="text-right font-bold text-xs uppercase py-2.5">Action</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((m) => {
                      const isSelected = selectedMemberIds.includes(m.userId);
                      const isEditingThisAp = editingApUserId === m.userId;

                      return (
                        <TableRow
                          key={m.userId}
                          className={`transition-colors py-1.5 ${
                            isSelected ? 'bg-primary/10' : m.overallMet ? 'hover:bg-emerald-500/5' : 'bg-amber-500/5 hover:bg-amber-500/10'
                          }`}
                        >
                          {isLeadership && (
                            <TableCell className="py-2">
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

                          {/* AP Column with Direct Cell Inline Editing */}
                          <TableCell className="py-2">
                            {isLeadership && isEditingThisAp ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  type="number"
                                  min="0"
                                  value={apInputVal}
                                  onChange={(e) => setApInputVal(e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  onClick={(e) => (e.target as HTMLInputElement).select()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveInlineAp(m.userId, m.ap.achieved);
                                    if (e.key === 'Escape') setEditingApUserId(null);
                                  }}
                                  onBlur={() => handleSaveInlineAp(m.userId, m.ap.achieved)}
                                  disabled={isSavingInlineAp}
                                  className="h-7 w-24 text-xs font-extrabold font-mono bg-background border-amber-500 focus:ring-1 focus:ring-amber-500 px-1.5"
                                  placeholder="AP..."
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
                                title={isLeadership ? 'Click cell to edit AP directly inline' : undefined}
                              >
                                <div className="flex items-center gap-1">
                                  <p className="font-extrabold text-xs text-foreground group-hover:text-amber-400 font-mono">
                                    {m.ap.achieved.toLocaleString()} / {m.ap.target.toLocaleString()}
                                  </p>
                                  {isLeadership && (
                                    <Edit2 className="w-3 h-3 text-amber-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </div>
                                <div className="h-1 w-full bg-muted/60 rounded-full overflow-hidden mt-0.5">
                                  <div className={`h-full rounded-full ${m.ap.isMet ? 'bg-emerald-400' : 'bg-amber-400'}`} style={{ width: `${m.ap.percentage}%` }} />
                                </div>
                              </div>
                            )}
                          </TableCell>

                          {/* PS Entry Segmented Controls */}
                          <TableCell className="py-2">
                            <TwoStatusButtons
                              isCompleted={m.ps.isMet}
                              isLeadership={isLeadership}
                              onSetCompleted={async () => { await setMemberPsStatus.mutateAsync({ userId: m.userId, newStatus: 'completed', count: m.ps.target }); }}
                              onSetPending={async () => { await setMemberPsStatus.mutateAsync({ userId: m.userId, newStatus: 'pending' }); }}
                            />
                          </TableCell>

                          {/* Daily Survey Segmented Controls (MOVED DIRECTLY NEXT TO PS ENTRY!) */}
                          <TableCell className="py-2">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-mono">
                                <span className="font-bold">{m.dailySurvey.displayText}</span>
                                <span className={m.dailySurvey.isMet ? 'text-emerald-400 font-bold' : 'text-purple-400 font-bold'}>
                                  {m.dailySurvey.percentage}%
                                </span>
                              </div>
                              <TwoStatusButtons
                                isCompleted={m.dailySurvey.isMet}
                                isLeadership={isLeadership}
                                onSetCompleted={async () => { await setMemberSurveyCount.mutateAsync({ userId: m.userId, count: m.dailySurvey.target }); }}
                                onSetPending={async () => { await setMemberSurveyCount.mutateAsync({ userId: m.userId, count: 0 }); }}
                              />
                            </div>
                          </TableCell>

                          {/* Meeting Segmented Controls */}
                          <TableCell className="py-2">
                            <TwoStatusButtons
                              isCompleted={m.groupMeeting.isMet}
                              isLeadership={isLeadership}
                              onSetCompleted={async () => { await setMemberMeetingStatus.mutateAsync({ userId: m.userId, status: 'completed' }); }}
                              onSetPending={async () => { await setMemberMeetingStatus.mutateAsync({ userId: m.userId, status: 'pending' }); }}
                            />
                          </TableCell>

                          {/* Status Badge */}
                          <TableCell className="py-2">
                            <Badge
                              variant={m.overallMet ? 'default' : 'destructive'}
                              className={`text-[10px] font-bold px-2 py-0.5 ${m.overallMet ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}
                            >
                              {m.overallMet ? '✓ Complete' : '! Missing'}
                            </Badge>
                          </TableCell>

                          {isLeadership && (
                            <TableCell className="text-right py-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 font-bold px-2"
                                onClick={() => handleOpenSingleAlert(m.userId)}
                              >
                                <Bell className="w-3 h-3" /> Alert
                              </Button>
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

          {/* VIEW MODE 2: COMPACT LIST VIEW (SURVEY DIRECTLY NEXT TO PS ENTRY) */}
          {viewMode === 'compact' && (
            <div className="space-y-1.5">
              {filteredMembers.map((m) => {
                const isSelected = selectedMemberIds.includes(m.userId);
                const isEditingThisAp = editingApUserId === m.userId;

                return (
                  <div
                    key={m.userId}
                    className={`p-3 rounded-xl border backdrop-blur-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                      isSelected ? 'bg-primary/10 border-primary' : m.overallMet ? 'bg-card border-emerald-500/30' : 'bg-card border-amber-500/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isLeadership && (
                        <Checkbox checked={isSelected} onCheckedChange={() => handleToggleSelectMember(m.userId)} />
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
                          <Badge variant="outline" className="text-[9px] capitalize font-medium px-1 py-0">
                            {m.role.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium leading-tight">{m.department}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Direct Inline AP Edit */}
                      {isLeadership && isEditingThisAp ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="number"
                            min="0"
                            value={apInputVal}
                            onChange={(e) => setApInputVal(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onClick={(e) => (e.target as HTMLInputElement).select()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineAp(m.userId, m.ap.achieved);
                              if (e.key === 'Escape') setEditingApUserId(null);
                            }}
                            onBlur={() => handleSaveInlineAp(m.userId, m.ap.achieved)}
                            disabled={isSavingInlineAp}
                            className="h-7 w-20 text-xs font-bold font-mono bg-background border-amber-500 px-1"
                            placeholder="AP..."
                            autoFocus
                          />
                          {isSavingInlineAp ? (
                            <Loader2 className="w-3 h-3 text-amber-500 animate-spin shrink-0" />
                          ) : (
                            <Button size="icon" className="h-7 w-7 bg-amber-600 hover:bg-amber-700 shrink-0" onClick={() => handleSaveInlineAp(m.userId, m.ap.achieved)}>
                              <Check className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartInlineApEdit(m)}
                          className={`px-2 py-0.5 rounded border text-[11px] font-bold font-mono transition-all ${
                            isLeadership ? 'cursor-pointer hover:bg-amber-500/20' : ''
                          } bg-amber-500/10 text-amber-400 border-amber-500/30`}
                        >
                          AP: {m.ap.achieved.toLocaleString()} / {m.ap.target.toLocaleString()}
                        </button>
                      )}
                      
                      {/* PS Buttons */}
                      <TwoStatusButtons
                        isCompleted={m.ps.isMet}
                        isLeadership={isLeadership}
                        onSetCompleted={async () => { await setMemberPsStatus.mutateAsync({ userId: m.userId, newStatus: 'completed', count: m.ps.target }); }}
                        onSetPending={async () => { await setMemberPsStatus.mutateAsync({ userId: m.userId, newStatus: 'pending' }); }}
                        completedLabel="PS Done"
                        pendingLabel="PS Pend"
                      />

                      {/* Daily Survey Buttons (MOVED DIRECTLY NEXT TO PS ENTRY!) */}
                      <TwoStatusButtons
                        isCompleted={m.dailySurvey.isMet}
                        isLeadership={isLeadership}
                        onSetCompleted={async () => { await setMemberSurveyCount.mutateAsync({ userId: m.userId, count: m.dailySurvey.target }); }}
                        onSetPending={async () => { await setMemberSurveyCount.mutateAsync({ userId: m.userId, count: 0 }); }}
                        completedLabel={`Surv ${m.dailySurvey.achieved}/${m.dailySurvey.target}`}
                        pendingLabel={`Surv 0/${m.dailySurvey.target}`}
                      />

                      {/* Meeting Buttons */}
                      <TwoStatusButtons
                        isCompleted={m.groupMeeting.isMet}
                        isLeadership={isLeadership}
                        onSetCompleted={async () => { await setMemberMeetingStatus.mutateAsync({ userId: m.userId, status: 'completed' }); }}
                        onSetPending={async () => { await setMemberMeetingStatus.mutateAsync({ userId: m.userId, status: 'pending' }); }}
                        completedLabel="Mtg Done"
                        pendingLabel="Mtg Pend"
                      />

                      {isLeadership && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-amber-500 hover:text-amber-400"
                          onClick={() => handleOpenSingleAlert(m.userId)}
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW MODE 3: GRID CARDS VIEW */}
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
                  onSetPsStatus={async (params) => {
                    await setMemberPsStatus.mutateAsync(params);
                  }}
                  onSetMeetingStatus={async (params) => {
                    await setMemberMeetingStatus.mutateAsync(params);
                  }}
                  onSetSurveyCount={async (params) => {
                    await setMemberSurveyCount.mutateAsync(params);
                  }}
                  onOpenAlertModal={handleOpenSingleAlert}
                />
              ))}
            </div>
          )}
        </>
      )}

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
              variant="outline"
              className="h-7 px-2 text-[11px] font-bold bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
              onClick={() => handleBulkAp(100)}
              disabled={bulkUpdateMembers.isPending}
            >
              +AP
            </Button>

            <Button
              size="sm"
              className="h-7 px-2.5 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
              onClick={() => handleBulkPs('completed')}
              disabled={bulkUpdateMembers.isPending}
            >
              PS
            </Button>

            <Button
              size="sm"
              className="h-7 px-2.5 text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
              onClick={() => handleBulkSurvey(4)}
              disabled={bulkUpdateMembers.isPending}
            >
              Survey
            </Button>

            <Button
              size="sm"
              className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              onClick={() => handleBulkMeeting('completed')}
              disabled={bulkUpdateMembers.isPending}
            >
              Meeting
            </Button>

            <Button
              size="sm"
              className="h-7 px-2.5 text-[11px] font-bold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-xs gap-1"
              onClick={() => setIsAlertModalOpen(true)}
            >
              <Bell className="w-3 h-3" /> Alert
            </Button>
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-slate-400 hover:text-white border-l border-slate-800 pl-2 ml-1"
            onClick={() => setSelectedMemberIds([])}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

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
        onScheduleAlert={async (params) => {
          await createScheduledAlert.mutateAsync(params);
        }}
      />

      <DailySurveyModal
        isOpen={isSurveyModalOpen}
        onClose={() => setIsSurveyModalOpen(false)}
        onSubmitSurvey={async (answers) => {
          await submitDailySurvey.mutateAsync(answers);
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

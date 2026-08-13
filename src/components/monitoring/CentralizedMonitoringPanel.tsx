import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Activity,
  Award,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit,
  Filter,
  Flame,
  LayoutDashboard,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldAlert,
  Star,
  Users,
  XCircle,
} from 'lucide-react';
import { useCentralizedMonitoring } from '@/hooks/useCentralizedMonitoring';
import { MemberMonitoringStatus } from '@/services/monitoringService';
import { SendLeadAlertModal } from '@/components/monitoring/SendLeadAlertModal';
import { DailySurveyWidget } from '@/components/survey/DailySurveyWidget';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { useAuth } from '@/hooks/useAuth';

export function CentralizedMonitoringPanel() {
  const { user } = useAuth();
  const {
    targets,
    members,
    isLoading,
    isFetching,
    isLead,
    refetch,
    updateTarget,
    isUpdatingTarget,
    setMemberAp,
    isSettingAp,
  } = useCentralizedMonitoring();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'missing' | 'ap' | 'ps' | 'survey'>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  
  // Modals state
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [editingApUser, setEditingApUser] = useState<MemberMonitoringStatus | null>(null);
  const [newApValue, setNewApValue] = useState<number>(0);

  // Editable Target Config State
  const [editableApTarget, setEditableApTarget] = useState<number>(targets.apTarget);
  const [editablePsTarget, setEditablePsTarget] = useState<number>(targets.psTarget);
  const [editableSurveyTarget, setEditableSurveyTarget] = useState<number>(targets.surveyTarget);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Search filter
      const matchesSearch =
        m.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Role filter
      if (selectedRole !== 'all' && m.role.toLowerCase() !== selectedRole.toLowerCase()) {
        return false;
      }

      // Status tab filter
      if (activeTab === 'completed') return m.overallStatus === 'met';
      if (activeTab === 'missing') return m.overallStatus === 'missing';
      if (activeTab === 'ap') return !m.ap.criteriaMet;
      if (activeTab === 'ps') return !m.ps.criteriaMet;
      if (activeTab === 'survey') return !m.survey.criteriaMet;

      return true;
    });
  }, [members, searchQuery, selectedRole, activeTab]);

  // Overall statistics summary
  const stats = useMemo(() => {
    const total = members.length;
    const metCount = members.filter((m) => m.overallStatus === 'met').length;
    const missingCount = total - metCount;
    const apMissing = members.filter((m) => !m.ap.criteriaMet).length;
    const psMissing = members.filter((m) => !m.ps.criteriaMet).length;
    const surveyMissing = members.filter((m) => !m.survey.criteriaMet).length;
    const metPercentage = total > 0 ? Math.round((metCount / total) * 100) : 0;

    return { total, metCount, missingCount, apMissing, psMissing, surveyMissing, metPercentage };
  }, [members]);

  const handleSaveTargets = async () => {
    try {
      await Promise.all([
        updateTarget({ targetType: 'ap', requiredValue: editableApTarget }),
        updateTarget({ targetType: 'ps', requiredValue: editablePsTarget }),
        updateTarget({ targetType: 'survey', requiredValue: editableSurveyTarget }),
      ]);
      setIsTargetModalOpen(false);
    } catch (err) {
      console.error('Save targets failed:', err);
    }
  };

  const handleSaveMemberAp = async () => {
    if (!editingApUser) return;
    try {
      await setMemberAp({ userId: editingApUser.userId, newApPoints: newApValue });
      setEditingApUser(null);
    } catch (err) {
      console.error('Save AP points failed:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner & Global Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 p-4 sm:p-6 rounded-2xl border border-blue-500/20 shadow-sm backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Activity className="w-6 h-6 text-blue-400 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Centralized Monitoring & Alerts
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Real-time compliance tracking for AP, Personalized Skills, Group Meetings, and Daily Surveys.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <RefreshButton onClick={() => refetch()} isRefreshing={isFetching} />

          {isLead && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditableApTarget(targets.apTarget);
                  setEditablePsTarget(targets.psTarget);
                  setEditableSurveyTarget(targets.surveyTarget);
                  setIsTargetModalOpen(true);
                }}
                className="h-9 text-xs border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              >
                <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                Configure Targets
              </Button>

              <Button
                size="sm"
                onClick={() => setIsAlertModalOpen(true)}
                className="h-9 text-xs bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-md"
              >
                <Bell className="w-3.5 h-3.5 mr-1.5" />
                Dispatch Lead Alert
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Daily Survey Widget Section (for logged-in member context) */}
      <DailySurveyWidget />

      {/* Key Metric Highlights Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Criteria Met</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {stats.metCount} / {stats.total}
              </p>
              <p className="text-[10px] text-emerald-600/80 font-medium">{stats.metPercentage}% compliant</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pending Members</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {stats.missingCount}
              </p>
              <p className="text-[10px] text-amber-600/80 font-medium">Require Lead Attention</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">PS Missing</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-purple-600 dark:text-purple-400">
                {stats.psMissing}
              </p>
              <p className="text-[10px] text-purple-600/80 font-medium">Req Min: {targets.psTarget}/wk</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-3.5 sm:p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Survey Missing</p>
              <p className="text-xl sm:text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {stats.surveyMissing}
              </p>
              <p className="text-[10px] text-blue-600/80 font-medium">Req Min: {targets.surveyTarget}/wk</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls & Search Toolbar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Member Monitoring Directory ({filteredMembers.length})
            </CardTitle>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search member name or role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-xs pl-8"
                />
              </div>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="h-8 text-xs bg-background border rounded-md px-2 text-foreground w-full sm:w-auto"
              >
                <option value="all">All Roles</option>
                <option value="member">Member</option>
                <option value="team_captain">Team Captain</option>
                <option value="team_manager">Team Manager</option>
                <option value="strategist">Strategist</option>
                <option value="incharge">Incharge</option>
              </select>
            </div>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(val: any) => setActiveTab(val)}
            className="w-full pt-2"
          >
            <TabsList className="w-full grid grid-cols-3 sm:grid-cols-6 h-8 text-xs">
              <TabsTrigger value="all" className="text-[11px]">All ({members.length})</TabsTrigger>
              <TabsTrigger value="completed" className="text-[11px]">Compliant ({stats.metCount})</TabsTrigger>
              <TabsTrigger value="missing" className="text-[11px]">Pending ({stats.missingCount})</TabsTrigger>
              <TabsTrigger value="ap" className="text-[11px]">AP ({stats.apMissing})</TabsTrigger>
              <TabsTrigger value="ps" className="text-[11px]">PS ({stats.psMissing})</TabsTrigger>
              <TabsTrigger value="survey" className="text-[11px]">Survey ({stats.surveyMissing})</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <XCircle className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">No members matching current criteria.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMembers.map((member) => (
                <Card
                  key={member.userId}
                  className={`overflow-hidden transition-all duration-200 border ${
                    member.overallStatus === 'met'
                      ? 'border-emerald-500/30 bg-emerald-500/[0.02]'
                      : 'border-amber-500/30 bg-amber-500/[0.02]'
                  }`}
                >
                  <div className="p-4 space-y-3">
                    {/* Member Profile Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm text-primary shrink-0">
                          {member.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold truncate leading-tight">
                            {member.fullName}
                          </h4>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                            {member.role.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge
                          variant={member.overallStatus === 'met' ? 'default' : 'destructive'}
                          className="text-[10px] px-2 py-0.5"
                        >
                          {member.overallStatus === 'met' ? 'Criteria Met' : 'Missing'}
                        </Badge>
                      </div>
                    </div>

                    {/* 4 Criteria Grid */}
                    <div className="space-y-2.5 pt-1 border-t">
                      {/* Activity Points (AP) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 font-medium">
                            <Star className="w-3.5 h-3.5 text-amber-500" />
                            Activity Points (AP)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                              {member.ap.achieved} / {member.ap.target}
                            </span>
                            {isLead && (
                              <button
                                onClick={() => {
                                  setEditingApUser(member);
                                  setNewApValue(member.ap.achieved);
                                }}
                                title="Lead Edit AP Points"
                                className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground"
                              >
                                <Edit className="w-3 h-3 text-amber-500" />
                              </button>
                            )}
                          </div>
                        </div>
                        <Progress value={member.ap.percentage} className="h-1.5 bg-amber-500/10" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{member.ap.criteriaMet ? 'Criteria Met' : `Needs ${member.ap.remaining} AP`}</span>
                          <span>{member.ap.percentage}%</span>
                        </div>
                      </div>

                      {/* Personalized Skills (PS) */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 font-medium">
                            <Award className="w-3.5 h-3.5 text-purple-500" />
                            Personalized Skills
                          </span>
                          <span className="font-semibold text-purple-600 dark:text-purple-400">
                            {member.ps.displayStatus}
                          </span>
                        </div>
                        <Progress value={member.ps.percentage} className="h-1.5 bg-purple-500/10" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{member.ps.criteriaMet ? 'Criteria Met' : 'Missing'}</span>
                          <span>{member.ps.percentage}%</span>
                        </div>
                      </div>

                      {/* Group Meeting */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 font-medium">
                            <Users className="w-3.5 h-3.5 text-indigo-500" />
                            Group Meeting
                          </span>
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {member.meeting.achieved} / {member.meeting.target}
                          </span>
                        </div>
                        <Progress value={member.meeting.percentage} className="h-1.5 bg-indigo-500/10" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{member.meeting.criteriaMet ? 'Criteria Met' : 'Missing'}</span>
                          <span>{member.meeting.percentage}%</span>
                        </div>
                      </div>

                      {/* Daily Survey */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            Daily Survey
                          </span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {member.survey.achieved} / {member.survey.target}
                          </span>
                        </div>
                        <Progress value={member.survey.percentage} className="h-1.5 bg-blue-500/10" />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>{member.survey.criteriaMet ? 'Criteria Met' : 'Missing'}</span>
                          <span>{member.survey.percentage}%</span>
                        </div>
                      </div>

                      {/* Negative Penalties badge if present */}
                      {member.negativePenalties > 0 && (
                        <div className="pt-1 flex items-center justify-between text-[11px] text-red-500 font-medium">
                          <span>Negative Penalty Status:</span>
                          <span>-{member.negativePenalties} Points</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Target Configuration Modal */}
      <Dialog open={isTargetModalOpen} onOpenChange={setIsTargetModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-500" />
              Configure Required Targets
            </DialogTitle>
            <DialogDescription className="text-xs">
              Authorized leads can adjust requirement thresholds for all members.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium">Activity Points (AP) Target</label>
              <Input
                type="number"
                value={editableApTarget}
                onChange={(e) => setEditableApTarget(parseInt(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-medium">Personalized Skills (PS) Required Count / Wk</label>
              <Input
                type="number"
                min="1"
                value={editablePsTarget}
                onChange={(e) => setEditablePsTarget(parseInt(e.target.value) || 1)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-medium">Daily Survey Required Count / Wk</label>
              <Input
                type="number"
                min="1"
                value={editableSurveyTarget}
                onChange={(e) => setEditableSurveyTarget(parseInt(e.target.value) || 1)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTargetModalOpen(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveTargets}
              disabled={isUpdatingTarget}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {isUpdatingTarget ? 'Saving...' : 'Save Targets'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Member AP Edit Modal */}
      <Dialog open={!!editingApUser} onOpenChange={() => setEditingApUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              Lead AP Point Override
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manually set Activity Points for {editingApUser?.fullName}. This single source of truth will update across all dashboards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium">New AP Points Value</label>
              <Input
                type="number"
                min="0"
                value={newApValue}
                onChange={(e) => setNewApValue(parseInt(e.target.value) || 0)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingApUser(null)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveMemberAp}
              disabled={isSettingAp}
              className="h-8 text-xs bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {isSettingAp ? 'Saving...' : 'Update AP Points'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Lead Alert Modal */}
      <SendLeadAlertModal
        isOpen={isAlertModalOpen}
        onClose={() => setIsAlertModalOpen(false)}
        members={members}
        initialCriteriaFilter={activeTab}
      />
    </div>
  );
}

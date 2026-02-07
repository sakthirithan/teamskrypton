import { useState, useEffect, useCallback, memo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trash2, Eye, Lock, Shield, Coins, Zap, Filter } from 'lucide-react';
import { 
  Target, 
  Calendar, 
  TrendingUp, 
  Plus, 
  Edit2, 
  Check, 
  User,
  Clock,
  CheckCircle,
  RotateCcw,
  AlertCircle,
  Download,
  History,
  Search
} from 'lucide-react';
import { useGroupingSessions, GroupingSession } from '@/hooks/useGroupingSessions';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries, PSDailyEntry } from '@/hooks/usePSDailyEntries';
import { useUserPoints } from '@/hooks/useUserPoints';
import { MySpaceAlertsPanel } from '@/components/grouping/MySpaceAlertsPanel';
import { SessionCard } from '@/components/grouping/SessionCard';
import { RoleBasedMySpaceFeatures } from '@/components/grouping/RoleBasedMySpaceFeatures';
import { BulkEntryCreation } from '@/components/grouping/BulkEntryCreation';
import { TestModeSettingsPanel } from '@/components/guest/TestModeSettingsPanel';
import { ReadOnlyWorkspaceIndicator } from '@/components/grouping/ReadOnlyWorkspaceIndicator';
import { PointsDisplay } from '@/components/points/PointsDisplay';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';
import { 
  calculateSessionDays, 
  calculateDaysRemaining,
  calculateTargetStatus,
  TARGET_STATUS_LABELS
} from '@/lib/groupingConstants';
import { format } from 'date-fns';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import * as XLSX from 'xlsx';

interface Profile {
  user_id: string;
  full_name: string;
}

// Inline points display component
const PointsDisplayInline = memo(function PointsDisplayInline({ userId }: { userId?: string }) {
  const { getUserPoints } = useUserPoints();
  const points = getUserPoints(userId);
  return (
    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{points}</p>
  );
});

const GroupingMe = () => {
  const { user, profile, isLoading, isLeadership, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Allow viewing another user's space (for leadership)
  const viewingUserId = searchParams.get('userId') || user?.id;
  const isViewingOther = viewingUserId !== user?.id;
  
  const { sessions, activeSession } = useGroupingSessions();
  
  // Session switching via Session Card
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const viewingSession = selectedSessionId 
    ? sessions.find(s => s.id === selectedSessionId) || activeSession
    : activeSession;
  
  const { myTargets } = useGroupingTargets(viewingSession?.id);
  const { 
    entries, 
    createEntry, 
    updateEntry, 
    completeEntry,
    revertEntry,
    attemptEntry,
    deleteEntry, 
    getTotalPoints,
    getPendingCount,
    getAttemptCount 
  } = usePSDailyEntries(viewingSession?.id, viewingUserId);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
    await queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
    await queryClient.invalidateQueries({ queryKey: ['grouping-sessions'] });
    setIsRefreshing(false);
  }, [queryClient]);

  // Fetch the profile of the user being viewed
  const { data: viewedProfile } = useQuery({
    queryKey: ['profile', viewingUserId],
    queryFn: async () => {
      if (!viewingUserId) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', viewingUserId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!viewingUserId && isViewingOther,
  });

  // Fetch the role of the user being viewed (for displaying role-based features)
  const { data: viewedUserRole } = useQuery({
    queryKey: ['user-role', viewingUserId],
    queryFn: async () => {
      if (!viewingUserId) return null;
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', viewingUserId)
        .maybeSingle();
      if (error) throw error;
      return data?.role || null;
    },
    enabled: !!viewingUserId && isViewingOther,
  });

  const displayProfile = isViewingOther ? viewedProfile : profile;
  const displayRole = isViewingOther ? viewedUserRole : role;

  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PSDailyEntry | null>(null);
  const [selectedEntrySessionId, setSelectedEntrySessionId] = useState<string | null>(null);
  const [entryForm, setEntryForm] = useState({
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    entry_time: '',
    skill_name: '',
    reward_points: 0,
    attempt_count: 1,
  });
  
  // Date filter state for PS entries table
  const [filterMode, setFilterMode] = useState<'all' | 'single' | 'range'>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [tableSearchText, setTableSearchText] = useState<string>('');
  
  // Get active sessions for entry creation dropdown
  const activeSessions = sessions.filter(s => s.status === 'active');
  const entrySession = selectedEntrySessionId 
    ? sessions.find(s => s.id === selectedEntrySessionId) 
    : activeSession;

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  // Get targets for the viewed user
  const viewedUserTargets = myTargets.filter(t => 
    t.target_scope === 'individual' && t.user_id === viewingUserId
  );
  const myIndividualTarget = viewedUserTargets[0];
  const groupTarget = myTargets.find(t => t.target_scope === 'group');
  
  // Only completed entries count toward target
  const myAchievedPoints = getTotalPoints(viewingUserId);
  const pendingCount = getPendingCount(viewingUserId);
  
  const totalDays = viewingSession 
    ? calculateSessionDays(viewingSession.start_date, viewingSession.end_date)
    : 0;
  const daysRemaining = viewingSession 
    ? calculateDaysRemaining(viewingSession.end_date)
    : 0;

  // Check if session is closed (read-only)
  const isSessionClosed = viewingSession?.status === 'closed';
  const isViewingHistory = selectedSessionId && viewingSession?.status === 'closed';
  
  // TL has full control on any user's My Space (not read-only)
  const isTL = role === 'team_captain' || role === 'team_manager' || role === 'vice_captain' || role === 'strategist';
  
  // STRICT READ-ONLY RULES:
  // 1. Closed session = always read-only for everyone
  // 2. Viewing another user's workspace = read-only EXCEPT for TL
  // 3. Own workspace + active session = can edit own entries
  const isReadOnlyMode = isSessionClosed || (isViewingOther && !isTL);
  
  // TL can add entries in any workspace; others can only add in own workspace
  const canAddEntry = !isSessionClosed && (!isViewingOther || isTL);
  
  // Can edit: 
  // - TL can edit any entry in active session
  // - Leadership can edit entries in their own workspace
  // - Owner can edit their own PENDING entries only (completed = locked)
  const canEditEntry = (entry: PSDailyEntry) => {
    if (isSessionClosed) return false;
    // Completed entries cannot be edited by anyone except TL for correction
    if (entry.status === 'completed' && !isTL) return false;
    // TL can edit any entry
    if (isTL) return true;
    // Other leadership can edit in their own workspace
    if (isLeadership && !isViewingOther) return true;
    // Owner can edit their own pending entries
    return entry.user_id === user?.id && entry.status === 'pending' && !isViewingOther;
  };
  
  // Can complete: 
  // - Entry owner in own workspace for pending entries
  // - TL/TM can complete entries in any workspace
  const canCompleteEntry = (entry: PSDailyEntry) => {
    if (isSessionClosed) return false;
    if (entry.status !== 'pending') return false;
    // TL/TM can complete any pending entry
    if (isTL) return true;
    // Owner can complete their own entries
    return entry.user_id === user?.id && !isViewingOther;
  };
  
  // Can mark as attempt:
  // - Entry owner in own workspace for pending entries
  // - TL/TM can mark entries in any workspace
  const canAttemptEntry = (entry: PSDailyEntry) => {
    if (isSessionClosed) return false;
    if (entry.status !== 'pending') return false;
    // TL/TM can mark any pending entry as attempt
    if (isTL) return true;
    // Owner can mark their own entries
    return entry.user_id === user?.id && !isViewingOther;
  };
  
  // Can revert: only TL/TM in active session for completed or attempt entries
  const canRevertEntry = (entry: PSDailyEntry) => {
    if (isSessionClosed) return false;
    return (isTL) && (entry.status === 'completed' || entry.status === 'attempt');
  };
  
  // Can delete: TL/TM can delete any, owner can delete own pending/attempt entries
  const canDeleteEntry = (entry: PSDailyEntry) => {
    if (isSessionClosed) return false;
    // TL/TM can delete any entry
    if (isTL) return true;
    // Owner can delete their own non-completed entries
    if (entry.user_id === user?.id && !isViewingOther) {
      if (entry.status === 'completed') return false;
      return true;
    }
    return false;
  };

  const handleDeleteEntry = async (entryId: string) => {
  const confirmDelete = window.confirm(
    'Are you sure you want to permanently delete this PS entry? This action cannot be undone.'
  );

  if (!confirmDelete) return;

  try {
    await deleteEntry.mutateAsync(entryId);
    toast({
      title: 'Entry deleted',
      description: 'PS Daily Entry has been permanently removed.',
    });
  } catch (error) {
    toast({
      variant: 'destructive',
      title: 'Delete failed',
      description: 'Unable to delete PS entry. Please try again.',
    });
  }
};


  const handleAddEntry = async () => {
    // Use selected entry session or fall back to current viewing session
    const targetSession = entrySession || viewingSession;
    if (!targetSession || !entryForm.skill_name || !viewingUserId) return;

    await createEntry.mutateAsync({
      session_id: targetSession.id,
      user_id: viewingUserId,
      entry_date: entryForm.entry_date,
      entry_time: entryForm.entry_time || undefined,
      skill_name: entryForm.skill_name,
      reward_points: entryForm.reward_points,
      attempt_count: entryForm.attempt_count,
    });

    setEntryForm({
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      entry_time: '',
      skill_name: '',
      reward_points: 0,
      attempt_count: 1,
    });
    setSelectedEntrySessionId(null);
    setIsAddEntryOpen(false);
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry) return;

    await updateEntry.mutateAsync({
      id: editingEntry.id,
      skill_name: entryForm.skill_name,
      reward_points: entryForm.reward_points,
      attempt_count: entryForm.attempt_count,
    });

    setEditingEntry(null);
    setEntryForm({
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      entry_time: '',
      skill_name: '',
      reward_points: 0,
      attempt_count: 1,
    });
  };

  const handleCompleteEntry = async (entryId: string) => {
    await completeEntry.mutateAsync(entryId);
  };

  const handleAttemptEntry = async (entryId: string) => {
    await attemptEntry.mutateAsync(entryId);
  };

  const handleRevertEntry = async (entryId: string) => {
    await revertEntry.mutateAsync(entryId);
  };

  const openEditEntry = (entry: PSDailyEntry) => {
    setEditingEntry(entry);
    setEntryForm({
      entry_date: entry.entry_date,
      entry_time: entry.entry_time || '',
      skill_name: entry.skill_name,
      reward_points: entry.reward_points,
      attempt_count: entry.attempt_count,
    });
  };

  // Date-based filtering for PS entries
  const filterEntriesByDate = (list: typeof entries) => {
    if (filterMode === 'all') return list;
    
    if (filterMode === 'single' && filterDate) {
      return list.filter(e => e.entry_date === filterDate);
    }
    
    if (filterMode === 'range' && filterFromDate && filterToDate) {
      return list.filter(e => {
        return e.entry_date >= filterFromDate && e.entry_date <= filterToDate;
      });
    }
    
    return list;
  };

  // Get filtered and sorted entries (recent on top, ascending if filtered)
  const getDisplayEntries = () => {
    let filtered = filterEntriesByDate(entries);
    
    // Search filter
    if (tableSearchText.trim()) {
      const q = tableSearchText.toLowerCase();
      filtered = filtered.filter(e => e.skill_name.toLowerCase().includes(q));
    }
    
    // Sort: if filter applied, ascending; otherwise recent on top (descending)
    const sorted = [...filtered].sort((a, b) => {
      const dateCompare = new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime();
      if (filterMode !== 'all') {
        return dateCompare; // Ascending when filtered
      }
      return -dateCompare; // Descending (recent first) by default
    });
    
    return sorted;
  };

  const displayEntries = getDisplayEntries();

  // Export PS entries for current session (respects filters)
  const handleExport = (exportFormat: 'csv' | 'xlsx') => {
    if (displayEntries.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No entries to export.' });
      return;
    }

    const exportData = displayEntries.map((entry, idx) => ({
      'S.No': idx + 1,
      'Date': format(new Date(entry.entry_date), 'dd-MM-yyyy'),
      'Time': entry.entry_time ? entry.entry_time.slice(0, 5) : '-',
      'Skill Name': entry.skill_name,
      'Reward Points': entry.reward_points,
      'Attempts': entry.attempt_count,
      'Status': entry.status.charAt(0).toUpperCase() + entry.status.slice(1),
      'Completed At': entry.completed_at ? format(new Date(entry.completed_at), 'yyyy-MM-dd HH:mm') : '-',
      'Session': viewingSession?.name || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PS Entries');

    const userName = displayProfile?.full_name?.replace(/\s+/g, '_') || 'user';
    const sessionName = viewingSession?.name?.replace(/\s+/g, '_') || 'session';
    const dateStr = filterMode === 'single' && filterDate 
      ? `_${format(new Date(filterDate), 'dd-MM-yyyy')}`
      : filterMode === 'range' && filterFromDate && filterToDate
        ? `_${format(new Date(filterFromDate), 'dd-MM-yyyy')}_to_${format(new Date(filterToDate), 'dd-MM-yyyy')}`
        : '';
    const filename = `PS_Entries_${userName}_${sessionName}${dateStr}.${exportFormat}`;
    XLSX.writeFile(wb, filename);

    toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
  };

  // Pending entries sum (for display only)
  const pendingPointsSum = entries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + e.reward_points, 0);
  
  // Attempt entries sum
  const attemptPointsSum = entries
    .filter(e => e.status === 'attempt')
    .reduce((sum, e) => sum + e.reward_points, 0);
  const attemptCount = getAttemptCount(viewingUserId);

  return (
    <TooltipProvider>
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 safe-area-bottom">
        <div className="space-y-6">
          {/* Profile Header with Role-Based Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold">{displayProfile?.full_name || 'Loading...'}</h2>
                    {isViewingOther && !isTL && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Read-Only
                      </Badge>
                    )}
                    {isViewingOther && isTL && (
                      <Badge variant="default" className="flex items-center gap-1 bg-primary">
                        <Edit2 className="w-3 h-3" />
                        Full Access
                      </Badge>
                    )}
                    {isSessionClosed && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Closed Session
                      </Badge>
                    )}
                  </div>
                  
                  {/* User Role Badge - Show below name */}
                  {displayRole && (
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="flex items-center gap-1 text-xs">
                        <Shield className="w-3 h-3" />
                        {ROLE_LABELS[displayRole as KryptonRole] || displayRole}
                      </Badge>
                    </div>
                  )}
                  
                  <p className="text-sm text-muted-foreground mt-1">
                    {isViewingOther ? `${displayProfile?.full_name}'s Grouping Space` : 'My Grouping Space'}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
          </Card>

          {/* Read-Only Mode Indicator */}
          {isReadOnlyMode && (
            <ReadOnlyWorkspaceIndicator
              viewingUserName={isViewingOther ? displayProfile?.full_name : undefined}
              isSessionClosed={isSessionClosed}
            />
          )}

          {/* Test Mode Settings Panel - Guest Users Only, own profile only */}
          {!isViewingOther && <TestModeSettingsPanel />}

          {/* Role-Based Features Section - Show below user name for own profile */}
            {!isViewingOther && viewingSession && (
              <CardContent className="pt-0 border-t mt-2 w-full">
                <RoleBasedMySpaceFeatures session={viewingSession} userId={viewingUserId} />
              </CardContent>
            )}

          {/* Session Card - Replaces the old session selector */}
          <SessionCard 
            sessions={sessions}
            activeSession={activeSession}
            selectedSession={viewingSession}
            onSessionChange={setSelectedSessionId}
          />

          {!viewingSession ? null : (
            <>
              {/* Personal Alerts Panel - session-bound, only show for own workspace or TL */}
              {(!isViewingOther || isTL) && (
                <MySpaceAlertsPanel 
                  userId={viewingUserId} 
                  isViewingOther={isViewingOther && !isTL}
                  session={viewingSession}
                />
              )}

              {/* Points Card - Common to both modes */}
              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 border-amber-200 dark:border-amber-800">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-200 dark:bg-amber-900/50 flex items-center justify-center">
                      <Coins className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-amber-700/80 dark:text-amber-400/80">Total Points</p>
                      <PointsDisplayInline userId={viewingUserId} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Session Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Completed</p>
                        <p className="text-2xl font-bold text-green-600">{myAchievedPoints}</p>
                        <p className="text-xs text-muted-foreground">
                          of {myIndividualTarget?.target_points || 0} pts
                        </p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Pending</p>
                        <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
                        <p className="text-xs text-muted-foreground">
                          {pendingPointsSum} pts waiting
                        </p>
                      </div>
                      <Clock className="w-8 h-8 text-yellow-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Days Left</p>
                        <p className="text-2xl font-bold">{daysRemaining}</p>
                        <p className="text-xs text-muted-foreground">of {totalDays} total</p>
                      </div>
                      <Calendar className="w-8 h-8 text-primary opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Group</p>
                        <p className="text-2xl font-bold">{groupTarget?.achieved_points || 0}</p>
                        <p className="text-xs text-muted-foreground">
                          of {groupTarget?.target_points || 0} pts
                        </p>
                      </div>
                      <Target className="w-8 h-8 text-blue-500 opacity-50" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* My Target Progress */}
              {myIndividualTarget && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Target Progress</span>
                      <Badge variant={
                        calculateTargetStatus(
                          myAchievedPoints, 
                          myIndividualTarget.target_points, 
                          daysRemaining, 
                          totalDays
                        ) === 'on_track' ? 'default' : 'destructive'
                      }>
                        {TARGET_STATUS_LABELS[
                          calculateTargetStatus(
                            myAchievedPoints, 
                            myIndividualTarget.target_points, 
                            daysRemaining, 
                            totalDays
                          )
                        ]}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Completed Progress</span>
                        <span className="font-medium">
                          {myAchievedPoints} / {myIndividualTarget.target_points} pts
                        </span>
                      </div>
                      <Progress 
                        value={
                          myIndividualTarget.target_points > 0
                            ? Math.min(100, (myAchievedPoints / myIndividualTarget.target_points) * 100)
                            : 0
                        } 
                        className="h-3"
                      />
                      {pendingCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          + {pendingPointsSum} pts pending completion
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* PS Daily Entries */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2">
                      PS Daily Entries
                      <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
                    </span>
                    <div className="flex items-center gap-2">
                      {entries.length > 0 && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => handleExport('csv')}>
                            <Download className="w-3 h-3 mr-1" />
                            CSV
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleExport('xlsx')}>
                            <Download className="w-3 h-3 mr-1" />
                            Excel
                          </Button>
                        </div>
                      )}
                      {canAddEntry && (
                        <Dialog open={isAddEntryOpen} onOpenChange={setIsAddEntryOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm">
                              <Plus className="w-4 h-4 mr-1" />
                              Add Entry
                            </Button>
                          </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add PS Daily Entry</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="p-3 rounded-lg bg-muted/50 text-sm">
                              <Clock className="w-4 h-4 inline mr-2 text-yellow-500" />
                              Entry starts as <strong>Pending</strong>. Mark as completed to add to targets.
                            </div>
                            
                            {/* Session Selection */}
                            <div className="space-y-2">
                              <Label>Session</Label>
                              <select
                                className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                value={selectedEntrySessionId || activeSession?.id || ''}
                                onChange={(e) => setSelectedEntrySessionId(e.target.value || null)}
                              >
                                {sessions.map((s) => (
                                  <option 
                                    key={s.id} 
                                    value={s.id}
                                    disabled={s.status === 'closed'}
                                  >
                                    Session #{s.session_number} - {s.name} 
                                    {s.status === 'closed' ? ' (Closed - Read Only)' : ''}
                                    {s.id === activeSession?.id ? ' (Active)' : ''}
                                  </option>
                                ))}
                              </select>
                              {sessions.find(s => s.id === selectedEntrySessionId)?.status === 'closed' && (
                                <p className="text-xs text-destructive">
                                  This session is closed and read-only. Select an active session.
                                </p>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Date</Label>
                                <Input
                                  type="date"
                                  value={entryForm.entry_date}
                                  onChange={(e) => setEntryForm({ ...entryForm, entry_date: e.target.value })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Time</Label>
                                <Input
                                  type="time"
                                  value={entryForm.entry_time}
                                  onChange={(e) => setEntryForm({ ...entryForm, entry_time: e.target.value })}
                                  placeholder="HH:MM"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Skill Name</Label>
                              <Input
                                value={entryForm.skill_name}
                                onChange={(e) => setEntryForm({ ...entryForm, skill_name: e.target.value })}
                                placeholder="e.g., Problem Solving, DSA"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Reward Points</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={entryForm.reward_points}
                                  onChange={(e) => setEntryForm({ ...entryForm, reward_points: parseInt(e.target.value) || 0 })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Attempts</Label>
                                <Input
                                  type="number"
                                  min="1"
                                  value={entryForm.attempt_count}
                                  onChange={(e) => setEntryForm({ ...entryForm, attempt_count: parseInt(e.target.value) || 1 })}
                                />
                              </div>
                            </div>
                            <Button 
                              onClick={handleAddEntry} 
                              className="w-full"
                              disabled={
                                createEntry.isPending || 
                                !entryForm.skill_name ||
                                (selectedEntrySessionId && sessions.find(s => s.id === selectedEntrySessionId)?.status === 'closed')
                              }
                            >
                              {createEntry.isPending ? 'Adding...' : 'Add Entry (Pending)'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Date Filter Controls */}
                  <div className="flex flex-wrap gap-2 items-end mb-4 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium">Filter:</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={filterMode === 'all' ? 'default' : 'outline'}
                        onClick={() => {
                          setFilterMode('all');
                          setFilterDate('');
                          setFilterFromDate('');
                          setFilterToDate('');
                        }}
                      >
                        All
                      </Button>
                      <Button
                        size="sm"
                        variant={filterMode === 'single' ? 'default' : 'outline'}
                        onClick={() => setFilterMode('single')}
                      >
                        Single Date
                      </Button>
                      <Button
                        size="sm"
                        variant={filterMode === 'range' ? 'default' : 'outline'}
                        onClick={() => setFilterMode('range')}
                      >
                        Date Range
                      </Button>
                    </div>
                    
                    {filterMode === 'single' && (
                      <Input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="w-auto"
                      />
                    )}
                    
                    {filterMode === 'range' && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          value={filterFromDate}
                          onChange={(e) => setFilterFromDate(e.target.value)}
                          className="w-auto"
                          placeholder="From"
                        />
                        <span className="text-muted-foreground">→</span>
                        <Input
                          type="date"
                          value={filterToDate}
                          onChange={(e) => setFilterToDate(e.target.value)}
                          className="w-auto"
                          placeholder="To"
                        />
                      </div>
                    )}
                    
                    {/* Search */}
                    <div className="flex-1 min-w-[150px]">
                      <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search skill..."
                          value={tableSearchText}
                          onChange={(e) => setTableSearchText(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                    
                    {/* Active filter badge */}
                    {filterMode === 'single' && filterDate && (
                      <Badge variant="secondary">
                        {format(new Date(filterDate), 'dd-MM-yyyy')}
                      </Badge>
                    )}
                    {filterMode === 'range' && filterFromDate && filterToDate && (
                      <Badge variant="secondary">
                        {format(new Date(filterFromDate), 'dd-MM-yyyy')} → {format(new Date(filterToDate), 'dd-MM-yyyy')}
                      </Badge>
                    )}
                  </div>

                  {displayEntries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {entries.length === 0 ? 'No entries yet. Add your first PS entry.' : 'No entries match the current filter.'}
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Skill</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                            <TableHead className="text-right">Attempts</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-32">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {displayEntries.map((entry, idx) => {
                            const isPending = entry.status === 'pending';
                            const isAttempt = entry.status === 'attempt';
                            const isCompleted = entry.status === 'completed';
                            const canEditThisEntry = canEditEntry(entry);
                            const canComplete = canCompleteEntry(entry);
                            const canAttempt = canAttemptEntry(entry);
                            const canRevert = canRevertEntry(entry);
                            const canDelete = canDeleteEntry(entry);
                            
                            // For completed entries, only show actions to TL/TM
                            const showActions = !isCompleted || isTL;
                            
                            return (
                              <TableRow 
                                key={entry.id} 
                                className={
                                  isPending ? 'bg-yellow-500/5' : 
                                  isAttempt ? 'bg-blue-500/5' : ''
                                }
                              >
                                <TableCell className="font-medium">{idx + 1}</TableCell>
                                <TableCell>{format(new Date(entry.entry_date), 'dd-MM-yyyy')}</TableCell>
                                <TableCell className="text-muted-foreground">
                                  {entry.entry_time ? entry.entry_time.slice(0, 5) : '—'}
                                </TableCell>
                                <TableCell>{entry.skill_name}</TableCell>
                                <TableCell className="text-right font-medium">{entry.reward_points}</TableCell>
                                <TableCell className="text-right">{entry.attempt_count}</TableCell>
                                <TableCell>
                                  {isPending ? (
                                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Pending
                                    </Badge>
                                  ) : isAttempt ? (
                                    <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                      <Zap className="w-3 h-3 mr-1" />
                                      Attempt
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Completed
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {showActions ? (
                                    <div className="flex items-center gap-1">
                                      {/* Mark Completed */}
                                      {canComplete && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                              onClick={() => handleCompleteEntry(entry.id)}
                                            >
                                              <Check className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Mark as Completed</TooltipContent>
                                        </Tooltip>
                                      )}

                                      {/* Mark as Attempt */}
                                      {canAttempt && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-500/10"
                                              onClick={() => handleAttemptEntry(entry.id)}
                                            >
                                              <Zap className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Mark as Attempt (effort, no points)</TooltipContent>
                                        </Tooltip>
                                      )}

                                      {/* Revert to Pending (TL/TM only) */}
                                      {canRevert && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10"
                                              onClick={() => handleRevertEntry(entry.id)}
                                            >
                                              <RotateCcw className="w-3 h-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Revert to Pending (TL/TM Only)</TooltipContent>
                                        </Tooltip>
                                      )}

                                      {/* Edit Entry */}
                                      {canEditThisEntry && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7"
                                              onClick={() => openEditEntry(entry)}
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Edit Entry</TooltipContent>
                                        </Tooltip>
                                      )}

                                      {/* Delete Entry */}
                                      {canDelete && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                              onClick={() => handleDeleteEntry(entry.id)}
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Delete Entry</TooltipContent>
                                        </Tooltip>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  
                  {/* Summary note */}
                  {attemptCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-3">
                      ⚡ {attemptCount} attempt entries ({attemptPointsSum} pts) — efforts that do NOT count toward targets
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Edit Entry Dialog */}
        <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Skill Name</Label>
                <Input
                  value={entryForm.skill_name}
                  onChange={(e) => setEntryForm({ ...entryForm, skill_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Reward Points</Label>
                  <Input
                    type="number"
                    min="0"
                    value={entryForm.reward_points}
                    onChange={(e) => setEntryForm({ ...entryForm, reward_points: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Attempts</Label>
                  <Input
                    type="number"
                    min="1"
                    value={entryForm.attempt_count}
                    onChange={(e) => setEntryForm({ ...entryForm, attempt_count: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <Button 
                onClick={handleUpdateEntry} 
                className="w-full"
                disabled={updateEntry.isPending}
              >
                {updateEntry.isPending ? 'Updating...' : 'Update Entry'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
    </TooltipProvider>
  );
};

export default GroupingMe;

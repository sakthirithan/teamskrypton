import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Calendar, Clock, Trash2, CheckCircle2, RotateCcw, Download, Filter, Zap } from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  calculateTargetStatus,
  calculateSessionDays,
  calculateDaysRemaining
} from '@/lib/groupingConstants';
import { format, startOfWeek, endOfWeek, parseISO, isWithinInterval } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface Profile {
  user_id: string;
  full_name: string;
}

interface GroupingAlertsPanelProps {
  session?: { id: string; start_date: string; end_date: string; status: string } | null;
}

type DialogType = 'pending' | 'completed' | 'attempt' | null;

export function GroupingAlertsPanel({ session }: GroupingAlertsPanelProps) {
  const { isLeadership, role } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeSession } = useGroupingSessions();
  
  // Check if user is TL or TM (full action access)
  const isLeads = role === 'team_captain' ||role === 'team_manager' || role === 'strategist' || role === 'vice_captain';
  
  //Check if user is Team Member
  // Team members (non-leadership)
const isTeamMember = !isLeads;

// Read-only completed visibility (members + leads)
const canViewCompleted = true;


  // Use passed session or fall back to active session
  const viewingSession = session || activeSession;
  
  const { targets } = useGroupingTargets(viewingSession?.id);
  const { entries, completeEntry, revertEntry, attemptEntry, deleteEntry } = usePSDailyEntries(viewingSession?.id);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  
  // Calendar filter state
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'single' | 'range'>('all');
  
  // Bulk selection state
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
  const [selectedCompletedIds, setSelectedCompletedIds] = useState<Set<string>>(new Set());
  const [selectedAttemptIds, setSelectedAttemptIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleteType, setBulkDeleteType] = useState<'pending' | 'completed' | 'attempt'>('pending');

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
    await queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
    setIsRefreshing(false);
  }, [queryClient]);

  const handleConfirmDelete = async () => {
    if (!deleteEntryId) return;

    const { error } = await supabase
      .from('ps_daily_entries')
      .delete()
      .eq('id', deleteEntryId);

    if (error) throw error;

    setDeleteEntryId(null);
    setShowDeleteDialog(false);

    await queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
    await queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
  };

  const openDialog = (type: DialogType) => {
    setSearchText('');
    setFilterDate('');
    setFilterFromDate('');
    setFilterToDate('');
    setFilterMode('all');
    setSelectedPendingIds(new Set());
    setSelectedCompletedIds(new Set());
    setSelectedAttemptIds(new Set());
    setActiveDialog(type);
  };

  // Bulk action handlers
  const handleBulkComplete = async () => {
    if (selectedPendingIds.size === 0) return;
    setIsBulkProcessing(true);
    
    try {
      for (const id of selectedPendingIds) {
        await completeEntry.mutateAsync(id);
      }
      toast({ title: 'Entries Completed', description: `${selectedPendingIds.size} entries marked as completed.` });
      setSelectedPendingIds(new Set());
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to complete some entries.', variant: 'destructive' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkAttempt = async () => {
    if (selectedPendingIds.size === 0) return;
    setIsBulkProcessing(true);
    
    try {
      for (const id of selectedPendingIds) {
        await attemptEntry.mutateAsync(id);
      }
      toast({ title: 'Entries Marked as Attempt', description: `${selectedPendingIds.size} entries marked as attempts.` });
      setSelectedPendingIds(new Set());
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to mark some entries as attempts.', variant: 'destructive' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkRevert = async (fromStatus: 'completed' | 'attempt') => {
    const idsToRevert = fromStatus === 'completed' ? selectedCompletedIds : selectedAttemptIds;
    if (idsToRevert.size === 0) return;
    setIsBulkProcessing(true);
    
    try {
      for (const id of idsToRevert) {
        await revertEntry.mutateAsync(id);
      }
      toast({ title: 'Entries Reverted', description: `${idsToRevert.size} entries moved back to pending.` });
      if (fromStatus === 'completed') {
        setSelectedCompletedIds(new Set());
      } else {
        setSelectedAttemptIds(new Set());
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to revert some entries.', variant: 'destructive' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    const idsToDelete = bulkDeleteType === 'pending' 
      ? selectedPendingIds 
      : bulkDeleteType === 'completed' 
        ? selectedCompletedIds 
        : selectedAttemptIds;
    if (idsToDelete.size === 0) return;
    setIsBulkProcessing(true);
    
    try {
      for (const id of idsToDelete) {
        await deleteEntry.mutateAsync(id);
      }
      toast({ title: 'Entries Deleted', description: `${idsToDelete.size} entries deleted.` });
      if (bulkDeleteType === 'pending') {
        setSelectedPendingIds(new Set());
      } else if (bulkDeleteType === 'completed') {
        setSelectedCompletedIds(new Set());
      } else {
        setSelectedAttemptIds(new Set());
      }
      setShowBulkDeleteDialog(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete some entries.', variant: 'destructive' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const toggleSelection = (id: string, type: 'pending' | 'completed' | 'attempt') => {
    const setter = type === 'pending' 
      ? setSelectedPendingIds 
      : type === 'completed' 
        ? setSelectedCompletedIds 
        : setSelectedAttemptIds;
    setter(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = (entries: typeof pendingEntries, type: 'pending' | 'completed' | 'attempt') => {
    const current = type === 'pending' 
      ? selectedPendingIds 
      : type === 'completed' 
        ? selectedCompletedIds 
        : selectedAttemptIds;
    const setter = type === 'pending' 
      ? setSelectedPendingIds 
      : type === 'completed' 
        ? setSelectedCompletedIds 
        : setSelectedAttemptIds;
    
    if (current.size === entries.length) {
      setter(new Set());
    } else {
      setter(new Set(entries.map(e => e.id)));
    }
  };

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-alerts', viewingSession?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .eq('is_test', false);
      if (error) throw error;
      return data as Profile[];
    },
  });

  if (!isLeadership || !viewingSession) return null;

  // Check if session is closed (read-only alerts)
  const isSessionClosed = viewingSession.status === 'closed';
  // Mutations & export only for leadership
  const canMutateEntries = isLeads && !isSessionClosed;
  const canExport = isLeads;

  const totalDays = calculateSessionDays(
    viewingSession.start_date,
    viewingSession.end_date
  );
  const daysRemaining = calculateDaysRemaining(viewingSession.end_date);

  // Filter entries by date
  const filterEntriesByDate = (list: typeof entries) => {
    if (filterMode === 'all') return list;
    
    if (filterMode === 'single' && filterDate) {
      return list.filter(e => e.entry_date === filterDate);
    }
    
    if (filterMode === 'range' && filterFromDate && filterToDate) {
      const from = parseISO(filterFromDate);
      const to = parseISO(filterToDate);
      return list.filter(e => {
        const entryDate = parseISO(e.entry_date);
        return isWithinInterval(entryDate, { start: from, end: to });
      });
    }
    
    return list;
  };

  // 🔔 ALERTS
  const alerts: {
    type: 'pending' | 'deadline' | 'completed' | 'attempt';
    message: string;
    users?: Profile[];
  }[] = [];

  // 🚨 TARGET ALERTS
  targets.forEach((target) => {
    if (target.target_scope !== 'individual' || !target.user_id) return;

    const userPoints = entries
      .filter(e => e.user_id === target.user_id && e.status === 'completed')
      .reduce((sum, e) => sum + e.reward_points, 0);

    const status = calculateTargetStatus(
      userPoints,
      target.target_points,
      daysRemaining,
      totalDays
    );
  });

  // ⏳ PENDING ENTRIES ALERT
  const pendingEntries = entries.filter(e => e.status === 'pending');

  if (pendingEntries.length > 0) {
    const pendingUserIds = Array.from(
      new Set(pendingEntries.map(e => e.user_id))
    );

    const pendingUsers = teamMembers.filter(m =>
      pendingUserIds.includes(m.user_id)
    );

    alerts.push({
      type: 'pending',
      message: `${pendingEntries.length} pending PS entries (${pendingUsers.length} users)`,
      users: pendingUsers,
    });
  }

  // ✅ COMPLETED ENTRIES ALERT
  const completedEntries = entries.filter(e => e.status === 'completed');

  if (completedEntries.length > 0) {
    const completedUserIds = Array.from(
      new Set(completedEntries.map(e => e.user_id))
    );

    alerts.push({
      type: 'completed',
      message: `${completedEntries.length} completed PS entries (${completedUserIds.length} users)`,
    });
  }

  // ⚡ ATTEMPT ENTRIES ALERT
  
  const attemptEntries = entries.filter(e => e.status === 'attempt');

  if (attemptEntries.length > 0) {
    const attemptUserIds = Array.from(
      new Set(attemptEntries.map(e => e.user_id))
    );

    alerts.push({
      type: 'attempt',
      message: `${attemptEntries.length} attempt PS entries (${attemptUserIds.length} users)`,
    });
  }

  // Search + date filtering
  const filterEntries = (list: typeof entries) => {
    const filtered = filterEntriesByDate(list);

    if (!searchText.trim()) return filtered;

    const q = searchText.toLowerCase();

    return filtered.filter(entry => {
      const member = teamMembers.find(m => m.user_id === entry.user_id);
      return (
        member?.full_name.toLowerCase().includes(q) ||
        entry.skill_name.toLowerCase().includes(q)
      );
    });
  };

  // Filtered entries for display
  const filteredPendingEntries = filterEntries(pendingEntries);
  const filteredCompletedEntries = filterEntries(completedEntries);
  const filteredAttemptEntries = filterEntries(attemptEntries);

  // ⏰ SESSION DEADLINE ALERT
  if (daysRemaining <= 3 && daysRemaining > 0) {
    alerts.push({
      type: 'deadline',
      message: `Session ends in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
    });
  }

  // Export function
  const handleExport = (type: 'pending' | 'completed' | 'attempt', exportFormat: 'xlsx') => {
    const data = type === 'pending' 
      ? filteredPendingEntries 
      : type === 'completed' 
        ? filteredCompletedEntries 
        : filteredAttemptEntries;
    
    if (data.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No entries to export.' });
      return;
    }

    const exportData = data.map((entry, idx) => ({
      'S.No': idx + 1,
      'User': teamMembers.find(m => m.user_id === entry.user_id)?.full_name || 'Unknown',
      'Date': format(new Date(entry.entry_date), 'dd-MM-yyyy'),
      'Time': entry.entry_time ? entry.entry_time.slice(0, 5) : '-',
      'Skill': entry.skill_name,
      'Points': entry.reward_points,
      'Attempts': entry.attempt_count,
      'Status': entry.status.charAt(0).toUpperCase() + entry.status.slice(1),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PS Entries');

    const dateStr = filterMode === 'single' && filterDate 
      ? format(parseISO(filterDate), 'dd-MM-yyyy')
      : filterMode === 'range' && filterFromDate && filterToDate
        ? `${format(parseISO(filterFromDate), 'dd-MM-yyyy')}_to_${format(parseISO(filterToDate), 'dd-MM-yyyy')}`
        : 'all';
    
    const filename = `PS_${type}_entries_${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
  };

  // Current week defaults for export
  const getCurrentWeekRange = () => {
    const now = new Date();
    return {
      from: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      to: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    };
  };

  const handleCurrentWeekExport = (type: 'pending' | 'completed' | 'attempt') => {
    const weekRange = getCurrentWeekRange();
    setFilterMode('range');
    setFilterFromDate(weekRange.from);
    setFilterToDate(weekRange.to);
    // Use timeout to allow state to update
    setTimeout(() => handleExport(type, 'xlsx'), 100);
  };

  // Calendar filter UI component
  const CalendarFilterUI = () => (
    <div className="flex flex-wrap gap-2 items-end mb-3 p-3 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <Label className="text-xs font-medium">Filter:</Label>
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
      
      {/* Show active filter summary */}
      {filterMode === 'single' && filterDate && (
        <Badge variant="secondary">
          {format(parseISO(filterDate), 'dd-MM-yyyy')}
        </Badge>
      )}
      {filterMode === 'range' && filterFromDate && filterToDate && (
        <Badge variant="secondary">
          {format(parseISO(filterFromDate), 'dd-MM-yyyy')} → {format(parseISO(filterToDate), 'dd-MM-yyyy')}
        </Badge>
      )}
    </div>
  );

  // Render table for a given status
  const renderEntriesTable = (
    filteredList: typeof entries, 
    type: 'pending' | 'completed' | 'attempt'
  ) => {
    const selectedIds = type === 'pending' 
      ? selectedPendingIds 
      : type === 'completed' 
        ? selectedCompletedIds 
        : selectedAttemptIds;
    
    return (
      <div className="max-h-[400px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {canMutateEntries && (
              <TableHead className="w-10">
                <Checkbox
                  checked={filteredList.length > 0 && selectedIds.size === filteredList.length}
                  onCheckedChange={() => selectAll(filteredList, type)}
                  disabled={isSessionClosed}
                />
              </TableHead>
              )}
              <TableHead>User</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Skill</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Attempts</TableHead>
              {canMutateEntries && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {filteredList.map(entry => {
              const member = teamMembers.find(m => m.user_id === entry.user_id);

              return (
                <TableRow key={entry.id} className={selectedIds.has(entry.id) ? 'bg-muted/50' : ''}>
                  {canMutateEntries && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(entry.id)}
                      onCheckedChange={() => toggleSelection(entry.id, type)}
                      disabled={isSessionClosed}
                    />
                  </TableCell>
                  )}
                  <TableCell>{member?.full_name || 'Unknown'}</TableCell>
                  <TableCell>{entry.entry_date ? format(new Date(entry.entry_date), 'dd-MM-yyyy') : '-'}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.entry_time ? entry.entry_time.slice(0, 5) : '—'}
                  </TableCell>
                  <TableCell>{entry.skill_name}</TableCell>
                  <TableCell className="text-right">{entry.reward_points}</TableCell>
                  <TableCell className="text-right">{entry.attempt_count}</TableCell>
                  {canMutateEntries && (
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        disabled={isSessionClosed}
                        onClick={() => {
                          setDeleteEntryId(entry.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="w-4 h-4" />
            Alerts & Risks
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
            {isSessionClosed && (
              <Badge variant="secondary" className="text-xs">Closed</Badge>
            )}
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {alerts.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No alerts. Everything looks good!
            </p>
          ) : (
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {alerts.map((alert, index) => (
                <div
                  key={index}
                  onClick={() => {
                    if(isLeads){
                      if (alert.type === 'pending') openDialog('pending');
                      if (alert.type === 'attempt') openDialog('attempt');
                    }
                    if (alert.type === 'completed') openDialog('completed');
                  }}
                  className={`flex items-start gap-2 p-2 rounded-lg text-sm cursor-pointer ${
                    alert.type === 'pending'
                      ? 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                      : alert.type === 'completed'
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                      : alert.type === 'attempt'
                      ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                      : 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
                  }`}
                >
                  
                  {alert.type === 'pending' && <Clock className="w-4 h-4 mt-0.5" />}
                  {alert.type === 'completed' && <CheckCircle2 className="w-4 h-4 mt-0.5" />}
                  {alert.type === 'attempt' && <Zap className="w-4 h-4 mt-0.5" />}
                  {alert.type === 'deadline' && <Calendar className="w-4 h-4 mt-0.5" />}

                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🔍 PENDING ENTRIES POPUP */}
      <Dialog open={activeDialog === 'pending'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                Pending PS Daily Entries
              </span>
              {selectedPendingIds.size > 0 && (
                <Badge variant="secondary">{selectedPendingIds.size} selected</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <CalendarFilterUI />

          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <Input
              placeholder="Search by user or skill..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2 flex-wrap">
              {canExport && (
              <Button size="sm" variant="outline" onClick={() => handleExport('pending', 'xlsx')}>
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              )}
              {selectedPendingIds.size > 0 && !isSessionClosed && (
                <>
                  <Button
                    size="sm"
                    onClick={handleBulkComplete}
                    disabled={isBulkProcessing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Complete ({selectedPendingIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkAttempt}
                    disabled={isBulkProcessing}
                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                  >
                    <Zap className="w-4 h-4 mr-1" />
                    Attempt ({selectedPendingIds.size})
                  </Button>
                  {isLeads && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        setBulkDeleteType('pending');
                        setShowBulkDeleteDialog(true);
                      }}
                      disabled={isBulkProcessing}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete ({selectedPendingIds.size})
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {renderEntriesTable(filteredPendingEntries, 'pending')}
        </DialogContent>
      </Dialog>

      {/* ✅ COMPLETED ENTRIES POPUP */}
      <Dialog open={activeDialog === 'completed'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Completed PS Daily Entries
              </span>
              {isTeamMember && (
              <Badge variant="outline" className="text-xs">
                Read only
              </Badge>
            )}
              {selectedCompletedIds.size > 0 && (
                <Badge variant="secondary">{selectedCompletedIds.size} selected</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <CalendarFilterUI />

          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <Input
              placeholder="Search by user or skill..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2 flex-wrap">
              {/*Completed Export Logic  */}
              {canExport && (
              <Button size="sm" variant="outline" onClick={() => handleExport('completed', 'xlsx')}>
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              )}
              {selectedCompletedIds.size > 0 && !isSessionClosed && isLeads && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkRevert('completed')}
                    disabled={isBulkProcessing}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Revert ({selectedCompletedIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setBulkDeleteType('completed');
                      setShowBulkDeleteDialog(true);
                    }}
                    disabled={isBulkProcessing}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete ({selectedCompletedIds.size})
                  </Button>
                </>
              )}
            </div>
          </div>

          {renderEntriesTable(filteredCompletedEntries, 'completed')}
        </DialogContent>
      </Dialog>

      {/* ⚡ ATTEMPT ENTRIES POPUP */}
      <Dialog open={activeDialog === 'attempt'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                Attempt PS Daily Entries
              </span>
              {selectedAttemptIds.size > 0 && (
                <Badge variant="secondary">{selectedAttemptIds.size} selected</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <CalendarFilterUI />

          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <Input
              placeholder="Search by user or skill..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => handleExport('attempt', 'xlsx')}>
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              {selectedAttemptIds.size > 0 && !isSessionClosed && isLeads && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkRevert('attempt')}
                    disabled={isBulkProcessing}
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Revert ({selectedAttemptIds.size})
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setBulkDeleteType('attempt');
                      setShowBulkDeleteDialog(true);
                    }}
                    disabled={isBulkProcessing}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete ({selectedAttemptIds.size})
                  </Button>
                </>
              )}
            </div>
          </div>

          {renderEntriesTable(filteredAttemptEntries, 'attempt')}
          
          <p className="text-xs text-muted-foreground mt-2">
            ⚡ Attempts represent effort but do NOT count toward target progress.
          </p>
        </DialogContent>
      </Dialog>

      {/* Delete Single Entry Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete PS Entry</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            This action cannot be undone. Deleted entries will be removed from:
            <br />• Individual PS records
            <br />• Target progress
            <br />• Team analytics
          </p>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Yes, Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* BULK DELETE CONFIRMATION DIALOG */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete {bulkDeleteType === 'pending' 
                ? selectedPendingIds.size 
                : bulkDeleteType === 'completed' 
                  ? selectedCompletedIds.size 
                  : selectedAttemptIds.size} PS Entries
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All selected entries will be permanently removed from:
            <br />• Individual PS records
            <br />• Target progress
            <br />• Team analytics
          </p>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowBulkDeleteDialog(false)} disabled={isBulkProcessing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkProcessing}>
              {isBulkProcessing ? 'Deleting...' : 'Yes, Delete All'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

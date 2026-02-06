import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Calendar, Clock, Trash2, CheckCircle2, RotateCcw } from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  calculateTargetStatus,
  calculateSessionDays,
  calculateDaysRemaining
} from '@/lib/groupingConstants';
import { format } from 'date-fns';
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

interface Profile {
  user_id: string;
  full_name: string;
}

interface GroupingAlertsPanelProps {
  session?: { id: string; start_date: string; end_date: string; status: string } | null;
}

export function GroupingAlertsPanel({ session }: GroupingAlertsPanelProps) {
  const { isLeadership } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { activeSession } = useGroupingSessions();
  
  // Use passed session or fall back to active session
  const viewingSession = session || activeSession;
  
  const { targets } = useGroupingTargets(viewingSession?.id);
  const { entries, completeEntry, revertEntry, deleteEntry } = usePSDailyEntries(viewingSession?.id);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [showCompletedDialog, setShowCompletedDialog] = useState(false);
  const [searchText, setSearchText] = useState('');
  
  // Bulk selection state
  const [selectedPendingIds, setSelectedPendingIds] = useState<Set<string>>(new Set());
  const [selectedCompletedIds, setSelectedCompletedIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [bulkDeleteType, setBulkDeleteType] = useState<'pending' | 'completed'>('pending');




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



  const openPendingDialog = () => {
    setSearchText('');
    setSelectedPendingIds(new Set());
    setShowPendingDialog(true);
  };

  const openCompletedDialog = () => {
    setSearchText('');
    setSelectedCompletedIds(new Set());
    setShowCompletedDialog(true);
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

  const handleBulkRevert = async () => {
    if (selectedCompletedIds.size === 0) return;
    setIsBulkProcessing(true);
    
    try {
      for (const id of selectedCompletedIds) {
        await revertEntry.mutateAsync(id);
      }
      toast({ title: 'Entries Reverted', description: `${selectedCompletedIds.size} entries moved back to pending.` });
      setSelectedCompletedIds(new Set());
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to revert some entries.', variant: 'destructive' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    const idsToDelete = bulkDeleteType === 'pending' ? selectedPendingIds : selectedCompletedIds;
    if (idsToDelete.size === 0) return;
    setIsBulkProcessing(true);
    
    try {
      for (const id of idsToDelete) {
        await deleteEntry.mutateAsync(id);
      }
      toast({ title: 'Entries Deleted', description: `${idsToDelete.size} entries deleted.` });
      if (bulkDeleteType === 'pending') {
        setSelectedPendingIds(new Set());
      } else {
        setSelectedCompletedIds(new Set());
      }
      setShowBulkDeleteDialog(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete some entries.', variant: 'destructive' });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const togglePendingSelection = (id: string) => {
    setSelectedPendingIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleCompletedSelection = (id: string) => {
    setSelectedCompletedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAllPending = (entries: typeof pendingEntries) => {
    if (selectedPendingIds.size === entries.length) {
      setSelectedPendingIds(new Set());
    } else {
      setSelectedPendingIds(new Set(entries.map(e => e.id)));
    }
  };

  const selectAllCompleted = (entries: typeof completedEntries) => {
    if (selectedCompletedIds.size === entries.length) {
      setSelectedCompletedIds(new Set());
    } else {
      setSelectedCompletedIds(new Set(entries.map(e => e.id)));
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

  const totalDays = calculateSessionDays(
    viewingSession.start_date,
    viewingSession.end_date
  );
  const daysRemaining = calculateDaysRemaining(viewingSession.end_date);

  // 🔔 ALERTS
  const alerts: {
    type: 'behind' | 'pending' | 'deadline' | 'completed';
    message: string;
    users?: Profile[];
  }[] = [];

  // 🚨 BEHIND TARGET ALERTS
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

    if (status === 'behind') {
      const member = teamMembers.find(m => m.user_id === target.user_id);
      alerts.push({
        type: 'behind',
        message: `${member?.full_name || 'Unknown'} is behind target`,
      });
    }
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

  // Completed Entries ALERT
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


  //Searching Logic
  const filterEntries = (list: typeof entries) => {
    if (!list || !searchText.trim()) return list || [];

    const q = searchText.toLowerCase();

    return list.filter(entry => {
      const member = teamMembers.find(m => m.user_id === entry.user_id);
      return (
        member?.full_name.toLowerCase().includes(q) ||
        entry.skill_name.toLowerCase().includes(q)
      );
    });
  };

  // Filtered entries for bulk selection
  const filteredPendingEntries = filterEntries(pendingEntries);
  const filteredCompletedEntries = filterEntries(completedEntries);




  // ⏰ SESSION DEADLINE ALERT
  if (daysRemaining <= 3 && daysRemaining > 0) {
    alerts.push({
      type: 'deadline',
      message: `Session ends in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
    });
  }

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
                    if (alert.type === 'pending') openPendingDialog();
                    if (alert.type === 'completed') openCompletedDialog();
                  }}

                  className={`flex items-start gap-2 p-2 rounded-lg text-sm cursor-pointer ${
                    alert.type === 'behind'
                      ? 'bg-red-500/10 text-red-700'
                      : alert.type === 'pending'
                      ? 'bg-yellow-500/10 text-yellow-700'
                      : alert.type === 'completed'
                      ? 'bg-green-500/10 text-green-700'
                      : 'bg-orange-500/10 text-orange-700'
                  }`}
                >
                  {alert.type === 'behind' && <TrendingDown className="w-4 h-4 mt-0.5" />}
                  {alert.type === 'pending' && <Clock className="w-4 h-4 mt-0.5" />}
                  {alert.type === 'completed' && <CheckCircle2 className="w-4 h-4 mt-0.5" />}
                  {alert.type === 'deadline' && <Calendar className="w-4 h-4 mt-0.5" />}

                  <span>{alert.message}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 🔍 PENDING ENTRIES POPUP */}
      <Dialog open={showPendingDialog} onOpenChange={setShowPendingDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Pending PS Daily Entries</span>
              {selectedPendingIds.size > 0 && (
                <Badge variant="secondary">{selectedPendingIds.size} selected</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <Input
              placeholder="Search by user or skill..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1"
            />
            {selectedPendingIds.size > 0 && !isSessionClosed && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleBulkComplete}
                  disabled={isBulkProcessing}
                  className="bg-primary hover:bg-primary/90"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Complete ({selectedPendingIds.size})
                </Button>
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
              </div>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredPendingEntries.length > 0 && selectedPendingIds.size === filteredPendingEntries.length}
                      onCheckedChange={() => selectAllPending(filteredPendingEntries)}
                      disabled={isSessionClosed}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredPendingEntries.map(entry => {
                  const member = teamMembers.find(m => m.user_id === entry.user_id);

                  return (
                    <TableRow key={entry.id} className={selectedPendingIds.has(entry.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPendingIds.has(entry.id)}
                          onCheckedChange={() => togglePendingSelection(entry.id)}
                          disabled={isSessionClosed}
                        />
                      </TableCell>
                      <TableCell>{member?.full_name || 'Unknown'}</TableCell>
                      <TableCell>{entry.entry_date ? format(new Date(entry.entry_date), 'yyyy-MM-dd') : '-' }</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.entry_time ? entry.entry_time.slice(0, 5) : '—'}
                      </TableCell>
                      <TableCell>{entry.skill_name}</TableCell>
                      <TableCell className="text-right">{entry.reward_points}</TableCell>
                      <TableCell className="text-right">{entry.attempt_count}</TableCell>
                      <TableCell className="text-right">
                        {isLeadership && (
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
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>


        {/* Delete Dialog */}
        {/* // 🔥 SHARED DELETE CONFIRMATION DIALOG (OUTSIDE ALL OTHERS) */}
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

      {/* ✅ COMPLETED ENTRIES POPUP */}
      <Dialog open={showCompletedDialog} onOpenChange={setShowCompletedDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Completed PS Daily Entries</span>
              {selectedCompletedIds.size > 0 && (
                <Badge variant="secondary">{selectedCompletedIds.size} selected</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row gap-2 mb-3">
            <Input
              placeholder="Search by user or skill..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1"
            />
            {selectedCompletedIds.size > 0 && !isSessionClosed && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkRevert}
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
              </div>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredCompletedEntries.length > 0 && selectedCompletedIds.size === filteredCompletedEntries.length}
                      onCheckedChange={() => selectAllCompleted(filteredCompletedEntries)}
                      disabled={isSessionClosed}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredCompletedEntries.map(entry => {
                  const member = teamMembers.find(m => m.user_id === entry.user_id);

                  return (
                    <TableRow key={entry.id} className={selectedCompletedIds.has(entry.id) ? 'bg-muted/50' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedCompletedIds.has(entry.id)}
                          onCheckedChange={() => toggleCompletedSelection(entry.id)}
                          disabled={isSessionClosed}
                        />
                      </TableCell>
                      <TableCell>{member?.full_name || 'Unknown'}</TableCell>
                      <TableCell>{entry.entry_date ? format(new Date(entry.entry_date), 'yyyy-MM-dd') : '-' }</TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.entry_time ? entry.entry_time.slice(0, 5) : '—'}
                      </TableCell>
                      <TableCell>{entry.skill_name}</TableCell>
                      <TableCell className="text-right">{entry.reward_points}</TableCell>
                      <TableCell className="text-right">{entry.attempt_count}</TableCell>
                      <TableCell className="text-right">
                        {isLeadership && (
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
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* BULK DELETE CONFIRMATION DIALOG */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {bulkDeleteType === 'pending' ? selectedPendingIds.size : selectedCompletedIds.size} PS Entries</DialogTitle>
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
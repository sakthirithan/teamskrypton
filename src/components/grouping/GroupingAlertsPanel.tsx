import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingDown, Calendar, Clock, Trash2 } from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { Input } from '@/components/ui/input';
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
import { CheckCircle2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
  const { activeSession } = useGroupingSessions();
  
  // Use passed session or fall back to active session
  const viewingSession = session || activeSession;
  
  const { targets } = useGroupingTargets(viewingSession?.id);
  const { entries } = usePSDailyEntries(viewingSession?.id);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPendingDialog, setShowPendingDialog] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  const [showCompletedDialog, setShowCompletedDialog] = useState(false);
  const [searchText, setSearchText] = useState('');




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
    setShowPendingDialog(true);
  };

  const openCompletedDialog = () => {
    setSearchText('');
    setShowCompletedDialog(true);
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pending PS Daily Entries</DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Search by user or skill..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="mb-3"
          />

          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filterEntries(pendingEntries).map(entry => {
                  const member = teamMembers.find(m => m.user_id === entry.user_id);

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{member?.full_name || 'Unknown'}</TableCell>
                      <TableCell>{entry.entry_date ? format(new Date(entry.entry_date), 'yyyy-MM-dd') : '-' }</TableCell>
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Completed PS Daily Entries</DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Search by user or skill..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="mb-3"
          />

          <div className="max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filterEntries(completedEntries).map(entry => {
                  const member = teamMembers.find(m => m.user_id === entry.user_id);

                  return (
                    <TableRow key={entry.id}>
                      <TableCell>{member?.full_name || 'Unknown'}</TableCell>
                      <TableCell>{entry.entry_date ? format(new Date(entry.entry_date), 'yyyy-MM-dd') : '-' }</TableCell>
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
    </>
  );
}
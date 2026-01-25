import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Download
} from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useGroupingTargets } from '@/hooks/useGroupingTargets';
import { usePSDailyEntries, PSDailyEntry } from '@/hooks/usePSDailyEntries';
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
import * as XLSX from 'xlsx';

interface Profile {
  user_id: string;
  full_name: string;
}

const GroupingMe = () => {
  const { user, profile, isLoading, isLeadership } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Allow viewing another user's space (for leadership)
  const viewingUserId = searchParams.get('userId') || user?.id;
  const isViewingOther = viewingUserId !== user?.id;
  
  const { activeSession } = useGroupingSessions();
  const { myTargets } = useGroupingTargets(activeSession?.id);
  const { 
    entries, 
    createEntry, 
    updateEntry, 
    completeEntry,
    revertEntry,
    deleteEntry, 
    getTotalPoints,
    getPendingCount 
  } = usePSDailyEntries(activeSession?.id, viewingUserId);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
    await queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
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

  const displayProfile = isViewingOther ? viewedProfile : profile;

  const [isAddEntryOpen, setIsAddEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PSDailyEntry | null>(null);
  const [entryForm, setEntryForm] = useState({
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    skill_name: '',
    reward_points: 0,
    attempt_count: 1,
  });

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
  
  const totalDays = activeSession 
    ? calculateSessionDays(activeSession.start_date, activeSession.end_date)
    : 0;
  const daysRemaining = activeSession 
    ? calculateDaysRemaining(activeSession.end_date)
    : 0;

  // Check if session is closed (read-only)
  const isSessionClosed = activeSession?.status === 'closed';
  const canEdit = !isSessionClosed && (!isViewingOther || isLeadership);
  const canChangeStatus = !isSessionClosed && (
    (!isViewingOther) || isLeadership
  );

  const handleAddEntry = async () => {
    if (!activeSession || !entryForm.skill_name || !viewingUserId) return;

    await createEntry.mutateAsync({
      session_id: activeSession.id,
      user_id: viewingUserId,
      entry_date: entryForm.entry_date,
      skill_name: entryForm.skill_name,
      reward_points: entryForm.reward_points,
      attempt_count: entryForm.attempt_count,
    });

    setEntryForm({
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      skill_name: '',
      reward_points: 0,
      attempt_count: 1,
    });
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
      skill_name: '',
      reward_points: 0,
      attempt_count: 1,
    });
  };

  const handleCompleteEntry = async (entryId: string) => {
    await completeEntry.mutateAsync(entryId);
  };

  const handleRevertEntry = async (entryId: string) => {
    await revertEntry.mutateAsync(entryId);
  };

  const openEditEntry = (entry: PSDailyEntry) => {
    setEditingEntry(entry);
    setEntryForm({
      entry_date: entry.entry_date,
      skill_name: entry.skill_name,
      reward_points: entry.reward_points,
      attempt_count: entry.attempt_count,
    });
  };

  // Export PS entries
  const handleExport = (exportFormat: 'csv' | 'xlsx') => {
    if (entries.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No entries to export.' });
      return;
    }

    const exportData = entries.map(entry => ({
      'S.No': entry.s_no,
      'Date': format(new Date(entry.entry_date), 'yyyy-MM-dd'),
      'Skill Name': entry.skill_name,
      'Reward Points': entry.reward_points,
      'Attempts': entry.attempt_count,
      'Status': entry.status === 'completed' ? 'Completed' : 'Pending',
      'Completed At': entry.completed_at ? format(new Date(entry.completed_at), 'yyyy-MM-dd HH:mm') : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PS Entries');

    const userName = displayProfile?.full_name?.replace(/\s+/g, '_') || 'user';
    const sessionName = activeSession?.name?.replace(/\s+/g, '_') || 'session';
    const filename = `PS_Entries_${userName}_${sessionName}.${exportFormat}`;
    XLSX.writeFile(wb, filename);

    toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
  };

  // Pending entries sum (for display only)
  const pendingPointsSum = entries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + e.reward_points, 0);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 safe-area-bottom">
        <div className="space-y-6">
          {/* Profile Header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">{displayProfile?.full_name || 'Loading...'}</h2>
                    {isViewingOther && (
                      <Badge variant="outline">Viewing as Leadership</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isViewingOther ? `${displayProfile?.full_name}'s Grouping Space` : 'My Grouping Space'}
                  </p>
                </div>
              </CardTitle>
            </CardHeader>
          </Card>

          {!activeSession ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No active session</p>
                <p className="text-sm">Wait for leadership to create a session.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {isSessionClosed && (
                <div className="p-4 rounded-lg bg-muted/50 border flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Session Closed</p>
                    <p className="text-sm text-muted-foreground">
                      This session is closed. Data is read-only.
                    </p>
                  </div>
                </div>
              )}

              {/* Session Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Current Session</p>
                        <p className="text-2xl font-bold">#{activeSession.session_number}</p>
                        <p className="text-sm text-muted-foreground">{activeSession.name}</p>
                      </div>
                      <Calendar className="w-8 h-8 text-primary opacity-50" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Completed Points</p>
                        <p className="text-2xl font-bold text-green-600">{myAchievedPoints}</p>
                        <p className="text-sm text-muted-foreground">
                          Target: {myIndividualTarget?.target_points || 0}
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
                        <p className="text-sm text-muted-foreground">
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
                        <p className="text-sm text-muted-foreground">Days Remaining</p>
                        <p className="text-2xl font-bold">{daysRemaining}</p>
                        <p className="text-sm text-muted-foreground">of {totalDays} total</p>
                      </div>
                      <Target className="w-8 h-8 text-orange-500 opacity-50" />
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
                      {canEdit && (
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
                            <div className="space-y-2">
                              <Label>Date</Label>
                              <Input
                                type="date"
                                value={entryForm.entry_date}
                                onChange={(e) => setEntryForm({ ...entryForm, entry_date: e.target.value })}
                              />
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
                              disabled={createEntry.isPending || !entryForm.skill_name}
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
                  {entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No entries yet. Add your first PS entry.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">#</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Skill</TableHead>
                            <TableHead className="text-right">Points</TableHead>
                            <TableHead className="text-right">Attempts</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entries.map((entry) => {
                            const isPending = entry.status === 'pending';
                            const canEditThisEntry = canEdit && (isPending || isLeadership);
                            
                            return (
                              <TableRow key={entry.id} className={isPending ? 'bg-yellow-500/5' : ''}>
                                <TableCell className="font-medium">{entry.s_no}</TableCell>
                                <TableCell>{format(new Date(entry.entry_date), 'MMM d')}</TableCell>
                                <TableCell>{entry.skill_name}</TableCell>
                                <TableCell className="text-right font-medium">{entry.reward_points}</TableCell>
                                <TableCell className="text-right">{entry.attempt_count}</TableCell>
                                <TableCell>
                                  {isPending ? (
                                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                                      <Clock className="w-3 h-3 mr-1" />
                                      Pending
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                      <CheckCircle className="w-3 h-3 mr-1" />
                                      Completed
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    {canChangeStatus && isPending && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                        onClick={() => handleCompleteEntry(entry.id)}
                                        title="Mark as Completed"
                                      >
                                        <Check className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {isLeadership && !isPending && !isSessionClosed && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-500/10"
                                        onClick={() => handleRevertEntry(entry.id)}
                                        title="Revert to Pending"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                      </Button>
                                    )}
                                    {canEditThisEntry && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => openEditEntry(entry)}
                                        title="Edit Entry"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
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
  );
};

export default GroupingMe;

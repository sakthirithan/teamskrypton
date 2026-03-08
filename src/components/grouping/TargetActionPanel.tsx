import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Target, Plus, Users, User, Trash2, Edit2, Eye } from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useGroupingTargets, GroupingTarget } from '@/hooks/useGroupingTargets';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { LEADERSHIP_ROLES } from '@/lib/roles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';





interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

interface TargetActionPanelProps {
  session?: { id: string; session_number: number; name: string; status: string } | null;
}

export function TargetActionPanel({ session }: TargetActionPanelProps) {
  const { role, user } = useAuth();
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { sessions } = useGroupingSessions();
  // Use passed session for session-bound targets
  const targetSession = session || sessions.find(s => s.status === 'active');
  const { targets, createTarget, updateTarget, deleteTarget } = useGroupingTargets(targetSession?.id);
  
  // Target creation: TL, VC, Strategist, TM can create targets
  // Team Members cannot unless editable flag is set on their target
  const canCreateTarget =
  !!role && LEADERSHIP_ROLES.includes(role);

  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewAllOpen, setIsViewAllOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<GroupingTarget | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [formData, setFormData] = useState({
    session_id: '',
    target_scope: 'individual' as 'group' | 'individual',
    user_id: '',
    selectedUsers: [] as string[],
    target_points: 0,
    editable: false,
    notes: '',
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
    setIsRefreshing(false);
  }, [queryClient]);

  // Fetch team members for assignment
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-for-targets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('is_test', false);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!user,
  });
    const { data: earnedPointsMap = {} } = useQuery<Record<string, number>>({
  queryKey: ['earned-points', targetSession?.id],
  enabled: !!targetSession,
  queryFn: async () => {
    const { data, error } = await supabase
      .from('ps_daily_entries')
      .select('user_id, reward_points,status')
      .eq('session_id', targetSession!.id);

    if (error) throw error;

    const map: Record<string, number> = {};
    
    data.forEach(row => {
      if (row.status === 'completed') {
        map[row.user_id] =
          (map[row.user_id] || 0) + (row.reward_points ?? 0);
      }
    });

    return map;
  },
});




  const resetForm = () => {
    setFormData({
      session_id: targetSession?.id || '',
      target_scope: 'individual',
      user_id: '',
      selectedUsers: [],
      target_points: 0,
      editable: false,
      notes: '',
    });
  };
  
  // Check if session is closed (read-only)
  const isSessionClosed = targetSession?.status === 'closed';

  const handleCreate = async () => {
    if (!formData.session_id || formData.target_points <= 0) return;
    
    if (formData.target_scope === 'group') {
      await createTarget.mutateAsync({
        session_id: formData.session_id,
        target_scope: 'group',
        user_id: null,
        target_points: formData.target_points,
        editable: formData.editable,
        notes: formData.notes,
      });
    }

    if (
    formData.target_scope === 'individual' &&
    formData.selectedUsers.length > 0
  ) {
    for (const userId of formData.selectedUsers) {
      await createTarget.mutateAsync({
        session_id: formData.session_id,
        target_scope: 'individual',
        user_id: userId, // ✅ THIS WAS MISSING
        target_points: formData.target_points,
        editable: formData.editable,
        notes: formData.notes,
      });
    }
  }
    
    resetForm();
    setIsCreateOpen(false);
  };

  const handleUpdate = async () => {
    if (!editingTarget) return;
    
    await updateTarget.mutateAsync({
      id: editingTarget.id,
      target_points: formData.target_points,
      editable: formData.editable,
      notes: formData.notes,
    });
    
    setEditingTarget(null);
    resetForm();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;

    await deleteTarget.mutateAsync(deleteTargetId);
    setDeleteTargetId(null);
  };


  const openEdit = (target: GroupingTarget) => {
    setEditingTarget(target);
    setFormData({
      session_id: target.session_id,
      target_scope: target.target_scope,
      user_id: target.user_id || '',
      selectedUsers: [],
      target_points: target.target_points,
      editable: target.editable,
      notes: target.notes || '',
    });
  };
    const toggleUser = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId],
    }));
  };


  // Team members see simplified view

  const { data: allTargets = [] } = useQuery({
    queryKey: ['all-targets-readonly', targetSession?.id],
    enabled: !canCreateTarget && !!targetSession,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('grouping_targets')
        .select('*')
        .eq('session_id', targetSession!.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as GroupingTarget[];
    },
  });

  /* ============================================================
     👤 TEAM MEMBER VIEW — READ ONLY (FIXED)
     ============================================================ */
  if (!canCreateTarget) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4" />
            Targets
            {isSessionClosed && (
              <Badge variant="secondary" className="ml-auto text-xs">
                Closed
              </Badge>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {!targetSession ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active session.
            </p>
          ) : targets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No targets available.
            </p>
          ) : (
            <ScrollArea className="max-h-[50vh] pr-3" style={{ overflowY: 'auto' }}>
            <div className="space-y-2">
              {allTargets.map(target => {
                const member = teamMembers.find(
                  m => m.user_id === target.user_id
                );

                const achieved =
                  target.target_scope === 'group'
                    ? Object.values(earnedPointsMap).reduce((a, b) => a + b, 0)
                    : earnedPointsMap[target.user_id ?? ''] ?? 0;

                return (
                  <div
                    key={target.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {target.target_scope === 'group' ? (
                        <Users className="w-4 h-4 text-blue-500" />
                      ) : (
                        <User className="w-4 h-4 text-green-500" />
                      )}

                      <span className="font-medium">
                        {target.target_scope === 'group'
                          ? 'Group'
                          : member?.full_name || 'Member'}
                      </span>

                      <span className="text-muted-foreground">
                        {achieved}/{target.target_points} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4" />
            Target Actions
            <RefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} />
            {isSessionClosed && (
              <Badge variant="secondary" className="text-xs">Closed</Badge>
            )}
          </span>
          {!isSessionClosed && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  onClick={() => {
                    resetForm();
                    setFormData(f => ({ ...f, session_id: targetSession?.id || '' }));
                  }}
                  disabled={!targetSession}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  New Target
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Target</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Session</Label>
                  <Select
                    value={formData.session_id}
                    onValueChange={(v) => setFormData({ ...formData, session_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.filter(s => s.status === 'active').map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          Session #{session.session_number} - {session.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Target Scope</Label>
                  <Select
                    value={formData.target_scope}
                    onValueChange={(v) => setFormData({ ...formData, target_scope: v as 'group' | 'individual' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="group">
                        <span className="flex items-center gap-2">
                          <Users className="w-4 h-4" /> Group Target
                        </span>
                      </SelectItem>
                      <SelectItem value="individual">
                        <span className="flex items-center gap-2">
                          <User className="w-4 h-4" /> Individual Target
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.target_scope === 'individual' && (
                  <div className="space-y-2">
                    <Label>Assign To (Multiple Members)</Label>

                    <ScrollArea className="h-[150px] border rounded-md p-2">
                      <div className="space-y-2">
                        {teamMembers.map(member => {
                          const selected = formData.selectedUsers.includes(member.user_id);

                          return (
                            <div
                              key={member.user_id}
                              className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                                selected ? 'bg-primary/10' : 'hover:bg-muted'
                              }`}
                              onClick={() => toggleUser(member.user_id)}
                            >
                              <Checkbox
                                checked={selected}
                                onCheckedChange={() => toggleUser(member.user_id)}
                              />
                              <span className="text-sm">{member.full_name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>

                    {formData.selectedUsers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {formData.selectedUsers.length} member(s) selected
                      </p>
                    )}
                  </div>
                )}


                <div className="space-y-2">
                  <Label>Target Points</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.target_points}
                    onChange={(e) => setFormData({ ...formData, target_points: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Editable by Individual</Label>
                  <Switch
                    checked={formData.editable}
                    onCheckedChange={(v) => setFormData({ ...formData, editable: v })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes (Optional)</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes..."
                  />
                </div>

                <Button
                  onClick={handleCreate}
                  className="w-full"
                  disabled={
                    createTarget.isPending ||
                    (formData.target_scope === 'individual' &&
                      formData.selectedUsers.length === 0)
                  }
                >
                {createTarget.isPending ? 'Creating...' : 'Create Target'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Closed Session Warning */}
        {isSessionClosed && (
          <div className="p-3 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Targets cannot be modified for closed sessions.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This session is archived. View targets in read-only mode.
            </p>
          </div>
        )}
        
        {!targetSession ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active session. Create a session first.
          </p>
        ) : targets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {isSessionClosed ? 'No targets in this closed session.' : 'No targets yet. Create your first target.'}
          </p>
        ) : (
          <div className="space-y-3">
            {/* Group target summary */}
            {targets.filter(t => t.target_scope === 'group').map(target => {
              const achieved = Object.values(earnedPointsMap).reduce((a, b) => a + b, 0);
              const progress = target.target_points > 0 ? Math.min(100, (achieved / target.target_points) * 100) : 0;
              return (
                <div key={target.id} className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">Group</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground tabular-nums">{achieved}/{target.target_points} pts</span>
                      {!isSessionClosed && (
                        <>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(target)}>
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteTargetId(target.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              );
            })}

            {/* Individual targets summary count */}
            {(() => {
              const individualTargets = targets.filter(t => t.target_scope === 'individual');
              if (individualTargets.length === 0) return null;
              const completedCount = individualTargets.filter(t => {
                const achieved = earnedPointsMap[t.user_id ?? ''] ?? 0;
                return achieved >= t.target_points;
              }).length;
              return (
                <button
                  onClick={() => setIsViewAllOpen(true)}
                  className="w-full p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary/70" />
                      <span className="text-sm font-medium">{individualTargets.length} Individual Targets</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {completedCount}/{individualTargets.length} done
                      </Badge>
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </button>
              );
            })()}
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingTarget} onOpenChange={(open) => !open && setEditingTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Target</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Target Points</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.target_points}
                  onChange={(e) => setFormData({ ...formData, target_points: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Editable by Individual</Label>
                <Switch
                  checked={formData.editable}
                  onCheckedChange={(v) => setFormData({ ...formData, editable: v })}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <Button 
                onClick={handleUpdate} 
                className="w-full"
                disabled={updateTarget.isPending}
              >
                {updateTarget.isPending ? 'Updating...' : 'Update Target'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Target Dialog */}
        <Dialog
          open={!!deleteTargetId}
          onOpenChange={(open) => !open && setDeleteTargetId(null)}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Target?</DialogTitle>
            </DialogHeader>

            <p className="text-sm text-muted-foreground">
              This action cannot be undone. Are you sure you want to delete this target?
            </p>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setDeleteTargetId(null)}
              >
                No
              </Button>

              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleteTarget.isPending}
              >
                {deleteTarget.isPending ? 'Deleting...' : 'Yes, Delete'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
}
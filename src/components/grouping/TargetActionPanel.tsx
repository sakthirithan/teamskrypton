import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Target, Plus, Users, User, Trash2, Edit2 } from 'lucide-react';
import { useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useGroupingTargets, GroupingTarget } from '@/hooks/useGroupingTargets';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RefreshButton } from '@/components/ui/RefreshIconButton';

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

export function TargetActionPanel() {
  const { isCaptainOrVice, isLeadership, user } = useAuth();
  const queryClient = useQueryClient();
  const { sessions, activeSession } = useGroupingSessions();
  const { targets, createTarget, updateTarget, deleteTarget } = useGroupingTargets(activeSession?.id);
  
  // Target creation: TL, VC, Strategist, TM can create targets
  // Team Members cannot unless editable flag is set on their target
  const canCreateTarget = isLeadership;
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<GroupingTarget | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [formData, setFormData] = useState({
    session_id: '',
    target_scope: 'individual' as 'group' | 'individual',
    user_id: '',
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

  const resetForm = () => {
    setFormData({
      session_id: activeSession?.id || '',
      target_scope: 'individual',
      user_id: '',
      target_points: 0,
      editable: false,
      notes: '',
    });
  };

  const handleCreate = async () => {
    if (!formData.session_id || formData.target_points <= 0) return;
    
    await createTarget.mutateAsync({
      session_id: formData.session_id,
      target_scope: formData.target_scope,
      user_id: formData.target_scope === 'individual' ? formData.user_id : null,
      target_points: formData.target_points,
      editable: formData.editable,
      notes: formData.notes,
    });
    
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

  const handleDelete = async (targetId: string) => {
    if (confirm('Are you sure you want to delete this target?')) {
      await deleteTarget.mutateAsync(targetId);
    }
  };

  const openEdit = (target: GroupingTarget) => {
    setEditingTarget(target);
    setFormData({
      session_id: target.session_id,
      target_scope: target.target_scope,
      user_id: target.user_id || '',
      target_points: target.target_points,
      editable: target.editable,
      notes: target.notes || '',
    });
  };

  if (!canCreateTarget) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4" />
            My Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            View your assigned targets in the main panel.
          </p>
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
          </span>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                onClick={() => {
                  resetForm();
                  setFormData(f => ({ ...f, session_id: activeSession?.id || '' }));
                }}
                disabled={!activeSession}
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
                    <Label>Assign To</Label>
                    <Select
                      value={formData.user_id}
                      onValueChange={(v) => setFormData({ ...formData, user_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  disabled={createTarget.isPending}
                >
                  {createTarget.isPending ? 'Creating...' : 'Create Target'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!activeSession ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active session. Create a session first.
          </p>
        ) : targets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No targets yet. Create your first target.
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {targets.slice(0, 5).map((target) => {
              const member = teamMembers.find(m => m.user_id === target.user_id);
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
                        : member?.full_name || 'Unknown'}
                    </span>
                    <span className="text-muted-foreground">
                      {target.achieved_points}/{target.target_points} pts
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEdit(target)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(target.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
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
      </CardContent>
    </Card>
  );
}

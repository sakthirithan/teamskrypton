import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Users, Search, Plus, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useMessengerChats } from '@/hooks/useMessengerChats';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupCreated?: (groupId: string, groupName: string) => void;
}

export function CreateGroupDialog({ open, onOpenChange, onGroupCreated }: CreateGroupDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendGroupMessage } = useMessengerChats();

  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch all profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-group-creation'],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, avatar_url, is_disabled, disabled_until')
        .or(`is_disabled.is.false,is_disabled.is.null,disabled_until.lt.${nowIso}`);
      if (error) throw error;
      return (data || []).filter((p) => p.user_id !== user?.id);
    },
  });

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(
      (p) => (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
    );
  }, [profiles, search]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({ variant: 'destructive', title: 'Group name required' });
      return;
    }
    if (selectedUserIds.length === 0) {
      toast({ variant: 'destructive', title: 'Select at least 1 member' });
      return;
    }

    setIsCreating(true);
    const allMembers = Array.from(new Set([user!.id, ...selectedUserIds]));
    const trimmedName = groupName.trim();

    try {
      // Step 1: Create a real conversation row to obtain a proper UUID
      let realGroupId: string | null = null;

      const convRes = await supabase
        .from('messenger_conversations' as any)
        .insert({
          type: 'group',
          title: trimmedName,
          creator_id: user!.id,
          metadata: {
            group_name: trimmedName,
            members: allMembers,
          },
        })
        .select('id')
        .single();

      if (!convRes.error && convRes.data) {
        realGroupId = (convRes.data as any).id as string;
        console.log('[GROUP CREATE] Conversation created with UUID:', realGroupId);
      } else {
        // Fallback: generate a crypto UUID client-side if table doesn't exist yet
        console.warn('[GROUP CREATE] messenger_conversations insert failed:', convRes.error?.message);
        realGroupId = crypto.randomUUID();
        console.log('[GROUP CREATE] Using client-generated UUID:', realGroupId);
      }

      // Step 2: Send the group welcome message with the real UUID
      await sendGroupMessage.mutateAsync({
        group_id: realGroupId,
        group_name: trimmedName,
        members: allMembers,
        message: `🎉 Group "${trimmedName}" created. Welcome members!`,
        title: trimmedName,
      });

      if (onGroupCreated) {
        onGroupCreated(realGroupId, trimmedName);
      }

      toast({ title: 'Group Created', description: `Added ${selectedUserIds.length} member(s).` });
      setGroupName('');
      setSelectedUserIds([]);
      onOpenChange(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to create group', description: e.message });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Users className="w-5 h-5 text-primary" />
            Create Private Group Chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground">Group Name *</Label>
            <Input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Frontend Architecture Team"
              className="h-9 text-xs rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">
                Select Members ({selectedUserIds.length} selected)
              </Label>
              <span className="text-[10px] text-muted-foreground">Visible only to added members</span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search people..."
                className="h-8 pl-8 text-xs rounded-xl"
              />
            </div>

            <div className="border border-border/80 rounded-xl divide-y divide-border/60 max-h-64 overflow-y-auto bg-card" style={{ scrollbarWidth: 'thin' }}>
              {filteredProfiles.map((p) => {
                const isSelected = selectedUserIds.includes(p.user_id);
                return (
                  <div
                    key={p.user_id}
                    onClick={() => toggleUser(p.user_id)}
                    className="p-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover" />
                        ) : (
                          p.full_name?.charAt(0)?.toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground truncate">{p.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{p.email || 'Team Member'}</p>
                      </div>
                    </div>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleUser(p.user_id)} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs rounded-xl">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateGroup}
              disabled={isCreating || !groupName.trim() || selectedUserIds.length === 0}
              className="text-xs font-bold rounded-xl px-4"
            >
              {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Create Group
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

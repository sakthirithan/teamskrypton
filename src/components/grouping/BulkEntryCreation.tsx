import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Users, Check, X, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePSDailyEntries } from '@/hooks/usePSDailyEntries';
import { GroupingSession, useGroupingSessions } from '@/hooks/useGroupingSessions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { RefreshButton } from '@/components/ui/RefreshIconButton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface BulkEntryCreationProps {
  session: GroupingSession;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
}

export function BulkEntryCreation({ session }: BulkEntryCreationProps) {
  const { isLeadership, user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { sessions, activeSession } = useGroupingSessions();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [formData, setFormData] = useState({
    selectedSessionId: session?.id || '',
    selectedUsers: [] as string[],
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    entry_time: '',
    skill_name: '',
    reward_points: 0,
  });

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['grouping-targets'] });
    await queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
    setIsRefreshing(false);
  }, [queryClient]);

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-bulk-entry'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('is_test', false);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: isLeadership,
  });

  // Get selected session object
  const selectedSession = sessions.find(s => s.id === formData.selectedSessionId);
  const isSelectedSessionClosed = selectedSession?.status === 'closed';

  const resetForm = () => {
    setFormData({
      selectedSessionId: activeSession?.id || session?.id || '',
      selectedUsers: [],
      entry_date: format(new Date(), 'yyyy-MM-dd'),
      entry_time: '',
      skill_name: '',
      reward_points: 0,
    });
  };

  const toggleUser = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId]
    }));
  };

  const selectAllUsers = () => {
    setFormData(prev => ({
      ...prev,
      selectedUsers: teamMembers.map(m => m.user_id)
    }));
  };

  const clearAllUsers = () => {
    setFormData(prev => ({
      ...prev,
      selectedUsers: []
    }));
  };

  const handleBulkCreate = async () => {
    if (formData.selectedUsers.length === 0 || !formData.skill_name || !formData.selectedSessionId) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please select session, users, and enter skill name'
      });
      return;
    }

    // Check if selected session is closed
    if (isSelectedSessionClosed) {
      toast({
        variant: 'destructive',
        title: 'Session Closed',
        description: 'Cannot create entries for a closed session'
      });
      return;
    }

    setIsCreating(true);

    try {
      // Get next s_no for the session
      const { data: existingEntries, error: fetchError } = await supabase
        .from('ps_daily_entries')
        .select('s_no')
        .eq('session_id', formData.selectedSessionId)
        .order('s_no', { ascending: false })
        .limit(1);

      if (fetchError) throw fetchError;

      const nextSNo = existingEntries && existingEntries.length > 0 
        ? (existingEntries[0].s_no || 0) + 1 
        : 1;

      // Create entries for all selected users
      const entriesToCreate = formData.selectedUsers.map((userId, index) => ({
        session_id: formData.selectedSessionId,
        user_id: userId,
        entry_date: formData.entry_date,
        entry_time: formData.entry_time || null,
        skill_name: formData.skill_name,
        reward_points: formData.reward_points,
        attempt_count: 1,
        status: 'pending',
        entered_by: user!.id,
        s_no: nextSNo + index,
        is_test: false,
      }));

      const { error } = await supabase
        .from('ps_daily_entries')
        .insert(entriesToCreate);

      if (error) throw error;

      toast({
        title: 'Bulk Entries Created',
        description: `Created ${entriesToCreate.length} pending entries for Session #${selectedSession?.session_number}`
      });

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['ps-daily-entries'] });
      
      resetForm();
      setIsOpen(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Hide if not leadership (session status check moved inside dialog)
  if (!isLeadership) {
    return null;
  }

  // Check if ALL sessions are closed
  const hasActiveSessions = sessions.some(s => s.status === 'active');

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        {!hasActiveSessions ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant="outline" size="sm" disabled className="cursor-not-allowed">
                  <Users className="w-4 h-4 mr-2" />
                  Bulk Create
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>No active sessions available. All sessions are closed.</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={resetForm}>
              <Users className="w-4 h-4 mr-2" />
              Bulk Create
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Create PS Entries</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Session Selection */}
            <div className="space-y-2">
              <Label>Target Session</Label>
              <select
                className="w-full h-10 px-3 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                value={formData.selectedSessionId}
                onChange={(e) => setFormData({ ...formData, selectedSessionId: e.target.value })}
              >
                <option value="">Select a session</option>
                {sessions.map((s) => (
                  <option 
                    key={s.id} 
                    value={s.id}
                    disabled={s.status === 'closed'}
                  >
                    Session #{s.session_number} - {s.name}
                    {s.status === 'closed' ? ' (Closed)' : ''}
                    {s.id === activeSession?.id ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
              {isSelectedSessionClosed && (
                <div className="flex items-center gap-2 text-xs text-destructive">
                  <Lock className="w-3 h-3" />
                  <span>This session is closed and read-only. Select an active session.</span>
                </div>
              )}
            </div>

            {/* User Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Members</Label>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={selectAllUsers}
                    className="h-7 text-xs"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    All
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearAllUsers}
                    className="h-7 text-xs"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[150px] border rounded-md p-2">
                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.user_id}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                        formData.selectedUsers.includes(member.user_id)
                          ? 'bg-primary/10'
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => toggleUser(member.user_id)}
                    >
                      <Checkbox 
                        checked={formData.selectedUsers.includes(member.user_id)}
                        onCheckedChange={() => toggleUser(member.user_id)}
                      />
                      <span className="text-sm">{member.full_name}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              {formData.selectedUsers.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formData.selectedUsers.length} member(s) selected
                </p>
              )}
            </div>

            {/* Entry Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.entry_date}
                  onChange={(e) => setFormData({ ...formData, entry_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={formData.entry_time}
                  onChange={(e) => setFormData({ ...formData, entry_time: e.target.value })}
                  placeholder="HH:MM"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Skill Name</Label>
              <Input
                value={formData.skill_name}
                onChange={(e) => setFormData({ ...formData, skill_name: e.target.value })}
                placeholder="e.g., Problem Solving, DSA"
              />
            </div>

            <div className="space-y-2">
              <Label>Default Reward Points</Label>
              <Input
                type="number"
                min="0"
                value={formData.reward_points}
                onChange={(e) => setFormData({ ...formData, reward_points: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
              <p className="font-medium text-yellow-700 dark:text-yellow-400">
                Entries will be created as Pending
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Members can mark them as completed individually
              </p>
            </div>

            <Button 
              onClick={handleBulkCreate} 
              className="w-full"
              disabled={
                isCreating || 
                formData.selectedUsers.length === 0 || 
                !formData.skill_name ||
                !formData.selectedSessionId ||
                isSelectedSessionClosed
              }
            >
              {isCreating ? 'Creating...' : `Create ${formData.selectedUsers.length} Entries`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
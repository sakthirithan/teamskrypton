import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, KryptonRole, LEADERSHIP_ROLES } from '@/lib/constants';

interface Member {
  user_id: string;
  full_name: string;
  role: KryptonRole | null;
}

type AssignmentType = 'all' | 'team_members' | 'leads' | string; // string for individual user_id

export function TaskCRUD() {
  const { user, profile, role, isCaptainOrVice } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ 
    title: '', 
    description: '', 
    assignTo: '' as AssignmentType,
    deadline: '' 
  });

  useEffect(() => {
    const fetchMembers = async () => {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      
      if (profiles && roles) {
        const roleMap = new Map(roles.map(r => [r.user_id, r.role as KryptonRole]));
        const membersWithRoles = profiles.map(p => ({
          user_id: p.user_id,
          full_name: p.full_name,
          role: roleMap.get(p.user_id) || null
        }));
        setMembers(membersWithRoles);
      }
    };
    fetchMembers();
  }, []);

  // Get assignable members based on current user's role
  const getAssignableMembers = () => {
    if (isCaptainOrVice) {
      return members;
    } else {
      // Strategist and Team Manager can only assign to team members
      return members.filter(m => m.role === 'team_member');
    }
  };

  // Get target users based on assignment type
  const getTargetUsers = (): string[] => {
    const assignableMembers = getAssignableMembers();
    
    switch (form.assignTo) {
      case 'all':
        return assignableMembers.map(m => m.user_id);
      case 'team_members':
        return assignableMembers.filter(m => m.role === 'team_member').map(m => m.user_id);
      case 'leads':
        return assignableMembers.filter(m => m.role && LEADERSHIP_ROLES.includes(m.role)).map(m => m.user_id);
      default:
        // Individual assignment
        if (form.assignTo && assignableMembers.some(m => m.user_id === form.assignTo)) {
          return [form.assignTo];
        }
        return [];
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !role || !form.title || !form.deadline || !form.assignTo) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields' });
      return;
    }

    const targetUsers = getTargetUsers();

    if (targetUsers.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'No valid members to assign' });
      return;
    }

    setIsLoading(true);
    
    try {
      const tasksToInsert = targetUsers.map(userId => ({
        title: form.title,
        description: form.description || null,
        assigned_to: userId,
        assigned_by: user.id,
        assigner_name: profile.full_name,
        assigner_role: ROLE_LABELS[role],
        deadline: new Date(form.deadline).toISOString(),
        status: 'idle' as const,
      }));

      const { error } = await supabase.from('tasks').insert(tasksToInsert);
      if (error) throw error;

      toast({ 
        title: 'Task Created', 
        description: `Task assigned to ${targetUsers.length} member(s)` 
      });
      setForm({ title: '', description: '', assignTo: '', deadline: '' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to create task' });
    }
    
    setIsLoading(false);
  };

  const assignableMembers = getAssignableMembers();
  const teamMembers = assignableMembers.filter(m => m.role === 'team_member');
  const leads = assignableMembers.filter(m => m.role && LEADERSHIP_ROLES.includes(m.role));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Plus className="w-5 h-5" /> Create Task
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Task Name *</Label>
            <Input 
              value={form.title} 
              onChange={(e) => setForm({ ...form, title: e.target.value })} 
              placeholder="Task name" 
            />
          </div>
          
          <div>
            <Label>Task Description</Label>
            <Textarea 
              value={form.description} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
              placeholder="Brief description" 
              rows={2} 
            />
          </div>
          
          <div>
            <Label>Assign To *</Label>
            <Select 
              value={form.assignTo} 
              onValueChange={(value) => setForm({ ...form, assignTo: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select assignment" />
              </SelectTrigger>
              <SelectContent>
                {/* Group Options */}
                {isCaptainOrVice && (
                  <SelectItem value="all">
                    <span className="font-medium">All</span>
                    <span className="text-xs text-muted-foreground ml-2">({assignableMembers.length} members)</span>
                  </SelectItem>
                )}
                
                {teamMembers.length > 0 && (
                  <SelectItem value="team_members">
                    <span className="font-medium">Team Members</span>
                    <span className="text-xs text-muted-foreground ml-2">({teamMembers.length})</span>
                  </SelectItem>
                )}
                
                {isCaptainOrVice && leads.length > 0 && (
                  <SelectItem value="leads">
                    <span className="font-medium">Leads</span>
                    <span className="text-xs text-muted-foreground ml-2">(TL, VC, Strategist, TM)</span>
                  </SelectItem>
                )}

                {/* Divider */}
                {assignableMembers.length > 0 && (
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                    Individual Assignment
                  </div>
                )}
                
                {/* Individual Members */}
                {assignableMembers.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name}
                    {m.role && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({ROLE_LABELS[m.role]})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isCaptainOrVice && (
              <p className="text-xs text-muted-foreground mt-1">
                You can only assign tasks to Team Members
              </p>
            )}
          </div>
          
          <div>
            <Label>Deadline *</Label>
            <Input 
              type="datetime-local" 
              value={form.deadline} 
              onChange={(e) => setForm({ ...form, deadline: e.target.value })} 
            />
          </div>

          <div className="p-3 rounded bg-muted/50 text-sm">
            <span className="text-muted-foreground">Assigned By: </span>
            <span className="font-medium">{profile?.full_name}</span>
            {role && (
              <span className="text-muted-foreground"> ({ROLE_LABELS[role]})</span>
            )}
          </div>
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Task
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS, KryptonRole } from '@/lib/constants';

interface Member {
  user_id: string;
  full_name: string;
  role: KryptonRole | null;
}

export function TaskCRUD() {
  const { user, profile, role, isCaptainOrVice } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ 
    title: '', 
    description: '', 
    assignTo: [] as string[], 
    assignToAll: false,
    deadline: '' 
  });

  useEffect(() => {
    const fetchMembers = async () => {
      // Fetch profiles
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name');
      
      // Fetch roles
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

  // Filter members based on current user's role
  const getAssignableMembers = () => {
    if (isCaptainOrVice) {
      // TL and VC can assign to everyone
      return members;
    } else {
      // Strategist and Team Manager can only assign to team members
      return members.filter(m => m.role === 'team_member');
    }
  };

  const assignableMembers = getAssignableMembers();

  const handleMemberToggle = (userId: string) => {
    setForm(prev => ({
      ...prev,
      assignTo: prev.assignTo.includes(userId)
        ? prev.assignTo.filter(id => id !== userId)
        : [...prev.assignTo, userId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !role || !form.title || !form.deadline) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields' });
      return;
    }

    const targetUsers = form.assignToAll 
      ? assignableMembers.map(m => m.user_id)
      : form.assignTo;

    if (targetUsers.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select at least one member' });
      return;
    }

    setIsLoading(true);
    
    try {
      // Create a single task record (shared task)
      const { error } = await supabase.from('tasks').insert({
        title: form.title,
        description: form.description || null,
        assigned_to: targetUsers[0], // For single assignment, or we handle "All" differently
        assigned_by: user.id,
        assigner_name: profile.full_name,
        assigner_role: ROLE_LABELS[role],
        deadline: new Date(form.deadline).toISOString(),
        status: 'idle',
      });

      // If multiple users selected, create individual task records
      if (targetUsers.length > 1) {
        const tasksToInsert = targetUsers.slice(1).map(userId => ({
          title: form.title,
          description: form.description || null,
          assigned_to: userId,
          assigned_by: user.id,
          assigner_name: profile.full_name,
          assigner_role: ROLE_LABELS[role],
          deadline: new Date(form.deadline).toISOString(),
          status: 'idle' as const,
        }));
        if (tasksToInsert.length > 0) {
          const { error: bulkError } = await supabase.from('tasks').insert(tasksToInsert);
          if (bulkError) throw bulkError;
        }
      }

      if (error) throw error;

      toast({ 
        title: 'Task Created', 
        description: `Task assigned to ${targetUsers.length} member(s)` 
      });
      setForm({ title: '', description: '', assignTo: [], assignToAll: false, deadline: '' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Failed to create task' });
    }
    
    setIsLoading(false);
  };

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
            <div className="mt-2 space-y-2">
              {isCaptainOrVice && (
                <div className="flex items-center space-x-2 p-2 rounded bg-primary/5 border">
                  <Checkbox 
                    id="assignAll"
                    checked={form.assignToAll}
                    onCheckedChange={(checked) => setForm({ 
                      ...form, 
                      assignToAll: checked as boolean,
                      assignTo: [] 
                    })}
                  />
                  <label htmlFor="assignAll" className="text-sm font-medium cursor-pointer">
                    Assign to All Members
                  </label>
                </div>
              )}
              
              {!form.assignToAll && (
                <div className="max-h-40 overflow-y-auto border rounded p-2 space-y-1">
                  {assignableMembers.map((m) => (
                    <div key={m.user_id} className="flex items-center space-x-2">
                      <Checkbox 
                        id={m.user_id}
                        checked={form.assignTo.includes(m.user_id)}
                        onCheckedChange={() => handleMemberToggle(m.user_id)}
                      />
                      <label htmlFor={m.user_id} className="text-sm cursor-pointer flex-1">
                        {m.full_name}
                        {m.role && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({ROLE_LABELS[m.role]})
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
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

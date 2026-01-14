import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TaskAssignmentSelect } from './TaskAssignmentSelect';
import { Plus, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ROLE_LABELS } from '@/lib/constants';

export function TaskCRUD() {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({ 
    title: '', 
    description: '', 
    assignTo: [] as string[],
    deadline: '' 
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !role || !form.title || !form.deadline || form.assignTo.length === 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please fill all required fields' });
      return;
    }

    setIsLoading(true);
    
    try {
      const tasksToInsert = form.assignTo.map(userId => ({
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
        description: `Task assigned to ${form.assignTo.length} member(s)` 
      });
      setForm({ title: '', description: '', assignTo: [], deadline: '' });
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
            <TaskAssignmentSelect
              value={form.assignTo}
              onChange={(userIds) => setForm({ ...form, assignTo: userIds })}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Select one or more members to assign this task
            </p>
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
            Create Task {form.assignTo.length > 0 && `(${form.assignTo.length} ${form.assignTo.length === 1 ? 'member' : 'members'})`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

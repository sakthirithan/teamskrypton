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

const ALLOWED_ROLES = [
  'team_captain',
  'vice_captain',
  'strategist',
  'team_manager',
] as const;

export function TaskCRUD() {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignTo: [] as string[],
    deadline: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    /* ---------------- HARD GUARDS ---------------- */

    if (!user || !profile || !role) {
      toast({
        variant: 'destructive',
        title: 'Authentication Error',
        description: 'You must be logged in to create tasks.',
      });
      return;
    }

    if (!ALLOWED_ROLES.includes(role)) {
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: 'You are not allowed to create tasks.',
      });
      return;
    }

    if (!form.title || !form.deadline || form.assignTo.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Missing Fields',
        description: 'Please fill all required fields.',
      });
      return;
    }

    const deadlineDate = new Date(form.deadline);
    if (deadlineDate <= new Date()) {
      toast({
        variant: 'destructive',
        title: 'Invalid Deadline',
        description: 'Deadline must be set in the future.',
      });
      return;
    }

    /* ---------------- INSERT LOGIC ---------------- */

    setIsLoading(true);

    try {
      const tasksToInsert = form.assignTo.map((assignedUserId) => ({
        title: form.title.trim(),
        description: form.description?.trim() || null,
        assigned_to: assignedUserId,
        assigned_by: user.id,
        assigner_name: profile.full_name,
        assigner_role: ROLE_LABELS[role],
        deadline: deadlineDate.toISOString(),
        status: 'idle', // FINAL & FIXED STATE
      }));

      const { error } = await supabase
        .from('tasks')
        .insert(tasksToInsert);

      if (error) throw error;

      toast({
        title: 'Task Created',
        description: `Task assigned to ${form.assignTo.length} ${
          form.assignTo.length === 1 ? 'member' : 'members'
        }.`,
      });

      // Reset form safely
      setForm({
        title: '',
        description: '',
        assignTo: [],
        deadline: '',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Task Creation Failed',
        description: error.message || 'Unable to create task.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Plus className="w-5 h-5" />
          Create Task
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Name */}
          <div>
            <Label>Task Name *</Label>
            <Input
              value={form.title}
              onChange={(e) =>
                setForm({ ...form, title: e.target.value })
              }
              placeholder="Task name"
            />
          </div>

          {/* Description */}
          <div>
            <Label>Task Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="Brief description"
              rows={2}
            />
          </div>

          {/* Assign To */}
          <div>
            <Label>Assign To *</Label>
            <TaskAssignmentSelect
              value={form.assignTo}
              onChange={(userIds) =>
                setForm({ ...form, assignTo: userIds })
              }
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Select one or more members to assign this task
            </p>
          </div>

          {/* Deadline */}
          <div>
            <Label>Deadline *</Label>
            <Input
              type="datetime-local"
              value={form.deadline}
              onChange={(e) =>
                setForm({ ...form, deadline: e.target.value })
              }
            />
          </div>

          {/* Assigned By */}
          <div className="p-3 rounded bg-muted/50 text-sm">
            <span className="text-muted-foreground">
              Assigned By:{' '}
            </span>
            <span className="font-medium">
              {profile.full_name}
            </span>
            <span className="text-muted-foreground">
              {' '}
              ({ROLE_LABELS[role]})
            </span>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Task
            {form.assignTo.length > 0 &&
              ` (${form.assignTo.length})`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
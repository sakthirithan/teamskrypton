import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateProject, useAddProjectMember, useAllProfiles, PriorityLevel } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const { user } = useAuth();
  const createProject = useCreateProject();
  const addMember = useAddProjectMember();
  const { data: allProfiles = [] } = useAllProfiles();

  // Get all user roles for display
  const { data: allUserRoles = [] } = useQuery({
    queryKey: ['all-user-roles-for-project'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('user_id, role');
      return data || [];
    },
  });

  const [form, setForm] = useState({
    name: '',
    description: '',
    priority: 'medium' as PriorityLevel,
    start_date: new Date().toISOString().split('T')[0],
    deadline: '',
    lead_id: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.name || !form.lead_id) return;

    const project = await createProject.mutateAsync({
      name: form.name,
      description: form.description || undefined,
      owner_id: user.id,
      priority: form.priority,
      start_date: form.start_date,
      deadline: form.deadline || undefined,
    });

    // Add the assigned lead as a project member with 'lead' role
    if (project?.id) {
      await addMember.mutateAsync({
        project_id: project.id,
        user_id: form.lead_id,
        role: 'lead',
      });

      // Send notification to assigned lead
      await supabase.from('grouping_notifications').insert({
        sender_id: user.id,
        recipient_id: form.lead_id,
        title: '📋 Assigned as Project Lead',
        message: `You've been assigned as the lead for project "${form.name}". You have full management access.`,
        type: 'assignment',
      });
    }

    setForm({ name: '', description: '', priority: 'medium', start_date: new Date().toISOString().split('T')[0], deadline: '', lead_id: '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Project Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Smart Analytics Dashboard"
            />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief project description..."
              rows={3}
            />
          </div>

          <div>
            <Label>Assign Project Lead *</Label>
            <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select a lead..." /></SelectTrigger>
              <SelectContent>
                {allProfiles.map(p => {
                  const userRole = allUserRoles.find(r => r.user_id === p.user_id);
                  return (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.full_name}{userRole ? ` — ${userRole.role.replace(/_/g, ' ')}` : ''}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v: PriorityLevel) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deadline</Label>
              <Input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Start Date</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.name || !form.lead_id || createProject.isPending}>
              {createProject.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

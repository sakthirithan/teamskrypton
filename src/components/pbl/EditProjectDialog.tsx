import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateProject, useDeleteProject, useProjectMembers, useAddProjectMember, useRemoveProjectMember, useAllProfiles, Project, PriorityLevel, ProjectStatus } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onDeleted?: () => void;
}

const statusLabels: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

export function EditProjectDialog({ open, onOpenChange, project, onDeleted }: EditProjectDialogProps) {
  const { isCaptainOrVice, user } = useAuth();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: allProfiles = [] } = useAllProfiles();
  const { data: members = [] } = useProjectMembers(project.id);
  const { data: allUserRoles = [] } = useQuery({
    queryKey: ['all-user-roles-edit'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id, role');
      return data || [];
    },
  });

  const currentLead = members.find(m => m.role === 'lead');

  const [form, setForm] = useState({
    name: project.name,
    description: project.description || '',
    priority: project.priority,
    status: project.status,
    start_date: project.start_date,
    deadline: project.deadline || '',
    lead_id: currentLead?.user_id || '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: project.name,
        description: project.description || '',
        priority: project.priority,
        status: project.status,
        start_date: project.start_date,
        deadline: project.deadline || '',
        lead_id: currentLead?.user_id || '',
      });
    }
  }, [open, project, currentLead]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) return;

    await updateProject.mutateAsync({
      id: project.id,
      name: form.name,
      description: form.description || null,
      priority: form.priority,
      status: form.status,
      start_date: form.start_date,
      deadline: form.deadline || null,
    });

    // Handle lead change
    if (form.lead_id && form.lead_id !== currentLead?.user_id) {
      // Remove old lead
      if (currentLead) {
        await removeMember.mutateAsync({ id: currentLead.id, projectId: project.id });
      }
      // Add new lead
      await addMember.mutateAsync({ project_id: project.id, user_id: form.lead_id, role: 'lead' });
      // Notify new lead
      if (user) {
        await supabase.from('grouping_notifications').insert({
          sender_id: user.id,
          recipient_id: form.lead_id,
          title: '📋 Assigned as Project Lead',
          message: `You've been assigned as the lead for project "${form.name}".`,
          type: 'assignment',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['project-members', project.id] });
    }

    onOpenChange(false);
  };

  const handleDelete = async () => {
    await deleteProject.mutateAsync(project.id);
    setConfirmDelete(false);
    onOpenChange(false);
    onDeleted?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Project Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: ProjectStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
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
              <Label>Project Lead</Label>
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

            <DialogFooter className="flex !justify-between gap-2">
              {isCaptainOrVice && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!form.name || updateProject.isPending}>
                  {updateProject.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project.name}" and all its milestones, tasks, and activity. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete Project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

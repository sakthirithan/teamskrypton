import { useState, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Milestone as MilestoneType,
  ProjectTask,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  MilestoneStatus,
} from '@/hooks/useProjects';
import { Plus, ChevronDown, ChevronRight, Trash2, CheckCircle2, Circle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
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

interface MilestonePanelProps {
  projectId: string;
  milestones: MilestoneType[];
  tasks: ProjectTask[];
  onMilestoneSelect: (id: string) => void;
  selectedMilestoneId: string | null;
  isProjectLead?: boolean;
}

const statusIcons: Record<MilestoneStatus, React.ReactNode> = {
  not_started: <Circle className="w-4 h-4 text-muted-foreground" />,
  in_progress: <Clock className="w-4 h-4 text-primary" />,
  completed: <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />,
  overdue: <AlertCircle className="w-4 h-4 text-destructive" />,
};

const statusLabels: Record<MilestoneStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
};

export const MilestonePanel = memo(function MilestonePanel({
  projectId,
  milestones,
  tasks,
  onMilestoneSelect,
  selectedMilestoneId,
  isProjectLead = false,
}: MilestonePanelProps) {
  const { isLeadership } = useAuth();
  const canManage = isLeadership || isProjectLead;
  const createMilestone = useCreateMilestone();
  const updateMilestone = useUpdateMilestone();
  const deleteMilestone = useDeleteMilestone();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MilestoneType | null>(null);

  const handleCreate = async () => {
    if (!newName) return;
    await createMilestone.mutateAsync({
      project_id: projectId,
      name: newName,
      due_date: newDueDate || undefined,
      sort_order: milestones.length,
    });
    setNewName('');
    setNewDueDate('');
    setShowCreate(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMilestone.mutateAsync({ id: deleteTarget.id, projectId });
    setDeleteTarget(null);
    if (selectedMilestoneId === deleteTarget.id) {
      onMilestoneSelect('');
    }
  };

  const getTasksForMilestone = (milestoneId: string) =>
    tasks.filter(t => t.milestone_id === milestoneId);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Milestones</CardTitle>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(!showCreate)} className="h-7 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {showCreate && (
            <div className="p-3 border border-dashed border-border rounded-lg space-y-2">
              <Input
                placeholder="Milestone name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <Input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} disabled={!newName || createMilestone.isPending} className="h-7 text-xs flex-1">
                  {createMilestone.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Create'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowCreate(false)} className="h-7 text-xs">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {milestones.length === 0 && !showCreate && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No milestones yet. Create your first milestone to get started.
            </p>
          )}

          {milestones.map((milestone) => {
            const mTasks = getTasksForMilestone(milestone.id);
            const done = mTasks.filter(t => t.status === 'done').length;
            const progress = mTasks.length > 0 ? Math.round((done / mTasks.length) * 100) : 0;
            const isSelected = selectedMilestoneId === milestone.id;

            return (
              <div
                key={milestone.id}
                className={`p-3 rounded-lg border cursor-pointer transition-colors group/ms ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-border/80 hover:bg-muted/30'
                }`}
                onClick={() => onMilestoneSelect(milestone.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  {isSelected ? (
                    <ChevronDown className="w-3.5 h-3.5 text-primary shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  )}
                  {statusIcons[milestone.status]}
                  <span className="text-sm font-medium flex-1 truncate">{milestone.name}</span>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <>
                        <Select
                          value={milestone.status}
                          onValueChange={(v: MilestoneStatus) => {
                            updateMilestone.mutate({ id: milestone.id, status: v });
                          }}
                        >
                          <SelectTrigger className="h-6 w-auto text-[10px] border-none bg-transparent p-0 px-1" onClick={(e) => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover/ms:opacity-100 transition-opacity text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(milestone); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="ml-6 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{done}/{mTasks.length} tasks</span>
                    {milestone.due_date && (
                      <span>{format(new Date(milestone.due_date), 'MMM d')}</span>
                    )}
                  </div>
                  <Progress value={progress} className="h-1" />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Milestone</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{deleteTarget?.name}" and all its tasks. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMilestone.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});

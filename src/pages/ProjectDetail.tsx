import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { MilestonePanel } from '@/components/pbl/MilestonePanel';
import { TaskBoard } from '@/components/pbl/TaskBoard';
import { ActivityFeed } from '@/components/pbl/ActivityFeed';
import {
  useProject,
  useMilestones,
  useProjectTasks,
  useProjectMembers,
  useProjectActivity,
  useAllProfiles,
  useUpdateProject,
  useAddProjectMember,
  useRemoveProjectMember,
  calculateProjectHealth,
  ProjectStatus,
} from '@/hooks/useProjects';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Users, ArrowLeft, Flag, Plus, X, UserPlus } from 'lucide-react';
import { format } from 'date-fns';

const statusLabels: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

const ProjectDetail = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isLeadership } = useAuth();
  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const { data: milestones = [] } = useMilestones(projectId);
  const { data: tasks = [] } = useProjectTasks(projectId);
  const { data: members = [] } = useProjectMembers(projectId);
  const { data: activities = [] } = useProjectActivity(projectId);
  const { data: profiles = [] } = useAllProfiles();
  const updateProject = useUpdateProject();
  const addMember = useAddProjectMember();
  const removeMember = useRemoveProjectMember();

  const [selectedMilestone, setSelectedMilestone] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  if (authLoading || projectLoading) {
    return (
      <PBLLayout title="Project">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PBLLayout>
    );
  }

  if (!project || !user) return null;

  const health = calculateProjectHealth(tasks, milestones, project.deadline);
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const milestoneTasks = selectedMilestone
    ? tasks.filter(t => t.milestone_id === selectedMilestone)
    : [];

  const memberProfiles = members.map(m => {
    const p = profiles.find(pr => pr.user_id === m.user_id);
    return { ...m, full_name: p?.full_name || 'Unknown' };
  });

  const nonMembers = profiles.filter(
    p => !members.some(m => m.user_id === p.user_id)
  );

  return (
    <PBLLayout title={project.name}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Back + Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="mt-1 shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold">{project.name}</h1>
              {isLeadership ? (
                <Select
                  value={project.status}
                  onValueChange={(v: ProjectStatus) => updateProject.mutate({ id: project.id, status: v })}
                >
                  <SelectTrigger className="h-7 w-auto text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{statusLabels[project.status]}</Badge>
              )}
              <Badge
                variant="outline"
                className={
                  health.label === 'healthy' ? 'border-[hsl(var(--success))]/40 text-[hsl(var(--success))]' :
                  health.label === 'risk' ? 'border-[hsl(var(--warning))]/40 text-[hsl(var(--warning))]' :
                  'border-destructive/40 text-destructive'
                }
              >
                {health.label === 'healthy' ? '🟢' : health.label === 'risk' ? '🟡' : '🔴'} Health: {health.score}%
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
              {project.deadline && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Due {format(new Date(project.deadline), 'MMM d, yyyy')}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {members.length} members
              </span>
            </div>
          </div>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm font-bold">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {completedTasks} of {tasks.length} tasks completed · {milestones.filter(m => m.status === 'completed').length}/{milestones.length} milestones done
            </p>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Milestones + Members */}
          <div className="lg:col-span-3 space-y-4">
            <MilestonePanel
              projectId={project.id}
              milestones={milestones}
              tasks={tasks}
              onMilestoneSelect={setSelectedMilestone}
              selectedMilestoneId={selectedMilestone}
            />

            {/* Members */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Team</CardTitle>
                  {isLeadership && (
                    <Button size="sm" variant="ghost" onClick={() => setShowAddMember(!showAddMember)} className="h-7 text-xs">
                      <UserPlus className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                {showAddMember && (
                  <Select onValueChange={(userId) => {
                    addMember.mutate({ project_id: project.id, user_id: userId });
                    setShowAddMember(false);
                  }}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Add member..." /></SelectTrigger>
                    <SelectContent>
                      {nonMembers.map(p => (
                        <SelectItem key={p.user_id} value={p.user_id} className="text-xs">{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {memberProfiles.map(m => (
                  <div key={m.id} className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-semibold">
                        {m.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs">{m.full_name}</span>
                    </div>
                    {isLeadership && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100"
                        onClick={() => removeMember.mutate({ id: m.id, projectId: project.id })}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
                {members.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">No members</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center: Task Board */}
          <div className="lg:col-span-6">
            {selectedMilestone ? (
              <TaskBoard
                projectId={project.id}
                milestoneId={selectedMilestone}
                tasks={milestoneTasks}
                profiles={profiles}
              />
            ) : (
              <div className="text-center py-16 border border-dashed border-border rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Select a milestone to view its tasks
                </p>
              </div>
            )}
          </div>

          {/* Right: Activity Feed */}
          <div className="lg:col-span-3">
            <ActivityFeed activities={activities} profiles={profiles} />
          </div>
        </div>
      </div>
    </PBLLayout>
  );
};

export default ProjectDetail;

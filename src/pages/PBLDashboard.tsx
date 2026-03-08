import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { ProjectHealthWidget } from '@/components/pbl/ProjectHealthWidget';
import { ProjectCard } from '@/components/pbl/ProjectCard';
import { CreateProjectDialog } from '@/components/pbl/CreateProjectDialog';
import { NotificationsPanel } from '@/components/pbl/NotificationsPanel';
import { useProjects, useAllProfiles } from '@/hooks/useProjects';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, FolderKanban } from 'lucide-react';
import { useState } from 'react';

const PBLDashboard = () => {
  const { user, isLoading, isLeadership } = useAuth();
  const navigate = useNavigate();
  useSessionPersistence();

  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: profiles = [] } = useAllProfiles();
  const [createOpen, setCreateOpen] = useState(false);

  // Fetch all tasks and milestones for health widget
  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-project-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_tasks')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allMilestones = [] } = useQuery({
    queryKey: ['all-milestones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('milestones')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch project member counts
  const { data: allMembers = [] } = useQuery({
    queryKey: ['all-project-members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select('project_id, user_id');
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!isLoading && !user) navigate('/auth');
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <PBLLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PBLLayout>
    );
  }

  if (!user) return null;

  const getMemberCount = (projectId: string) =>
    allMembers.filter(m => m.project_id === projectId).length;

  const getProjectTasks = (projectId: string) =>
    allTasks.filter(t => t.project_id === projectId);

  const getProjectMilestones = (projectId: string) =>
    allMilestones.filter(m => m.project_id === projectId);

  const activeProjects = projects.filter(p => p.status !== 'archived');

  return (
    <PBLLayout title="Dashboard">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Health Widget */}
        <ProjectHealthWidget
          projects={projects}
          allTasks={allTasks}
          allMilestones={allMilestones}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Projects Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Projects</h2>
              </div>
              {isLeadership && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  New Project
                </Button>
              )}
            </div>

            {projectsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-48 rounded-lg skeleton-loader" />
                ))}
              </div>
            ) : activeProjects.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-border rounded-lg">
                <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No projects yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create your first project to get started</p>
                {isLeadership && (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Create Project
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    tasks={getProjectTasks(project.id)}
                    milestones={getProjectMilestones(project.id)}
                    memberCount={getMemberCount(project.id)}
                    onClick={() => navigate(`/pbl/projects/${project.id}`)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Notifications */}
          <div className="lg:col-span-1">
            <NotificationsPanel userId={user.id} />
          </div>
        </div>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PBLLayout>
  );
};

export default PBLDashboard;

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { ProjectCard } from '@/components/pbl/ProjectCard';
import { CreateProjectDialog } from '@/components/pbl/CreateProjectDialog';
import { useProjects, useAllProfiles, ProjectStatus } from '@/hooks/useProjects';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, FolderKanban, Filter } from 'lucide-react';

const PBLProjects = () => {
  const { user, isLoading: authLoading, isLeadership } = useAuth();
  const navigate = useNavigate();
  const { data: projects = [], isLoading } = useProjects();
  const { data: profiles = [] } = useAllProfiles();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  const { data: allTasks = [] } = useQuery({
    queryKey: ['all-project-tasks'],
    queryFn: async () => {
      const { data } = await supabase.from('project_tasks').select('*');
      return data || [];
    },
  });

  const { data: allMilestones = [] } = useQuery({
    queryKey: ['all-milestones'],
    queryFn: async () => {
      const { data } = await supabase.from('milestones').select('*');
      return data || [];
    },
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['all-project-members'],
    queryFn: async () => {
      const { data } = await supabase.from('project_members').select('project_id, user_id, role');
      return data || [];
    },
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  if (authLoading || !user) return null;

  const filtered = projects
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const statuses: (ProjectStatus | 'all')[] = ['all', 'planning', 'active', 'on_hold', 'completed'];
  const statusLabels: Record<string, string> = {
    all: 'All',
    planning: 'Planning',
    active: 'Active',
    on_hold: 'On Hold',
    completed: 'Completed',
  };

  return (
    <PBLLayout title="Projects">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 h-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 flex-wrap">
              {statuses.map(s => (
                <Badge
                  key={s}
                  variant={statusFilter === s ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setStatusFilter(s)}
                >
                  {statusLabels[s]}
                </Badge>
              ))}
            </div>
            {isLeadership && (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            )}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-48 skeleton-loader rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-lg">
            <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold mb-1">No projects found</h3>
            <p className="text-sm text-muted-foreground">
              {search ? 'Try a different search term' : 'Create your first project'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                tasks={allTasks.filter(t => t.project_id === project.id)}
                milestones={allMilestones.filter(m => m.project_id === project.id)}
                memberCount={allMembers.filter(m => m.project_id === project.id).length}
                onClick={() => navigate(`/pbl/projects/${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </PBLLayout>
  );
};

export default PBLProjects;

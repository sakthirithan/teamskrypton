import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderKanban, ListChecks, FileText, BarChart3, User } from 'lucide-react';
import { useProjects } from '@/hooks/useProjects';
import { MemberProjectsPanel } from '@/components/pbl/MemberProjectsPanel';
import { NotificationsPanel } from '@/components/pbl/NotificationsPanel';

const PBLMySpace = () => {
  const { user, isLoading, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) navigate('/auth');
  }, [user, isLoading, navigate]);

  if (isLoading || !user) return null;

  return (
    <PBLLayout title="My Space">
      <div className="space-y-6">
        {/* Profile header */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">{profile?.full_name}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="projects" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="projects" className="text-xs gap-1">
              <FolderKanban className="w-3.5 h-3.5" />
              My Projects
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs gap-1">
              <ListChecks className="w-3.5 h-3.5" />
              My Tasks
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs gap-1">
              <BarChart3 className="w-3.5 h-3.5" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            <MemberProjectsPanel userId={user.id} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-4">
            <MemberProjectsPanel userId={user.id} />
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <NotificationsPanel userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </PBLLayout>
  );
};

export default PBLMySpace;

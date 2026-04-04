import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PBLLayout } from '@/components/pbl/PBLLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FolderKanban, ListChecks, BarChart3, User, Bell } from 'lucide-react';
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
      <div className="space-y-6 max-w-5xl mx-auto">
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="projects" className="text-xs gap-1">
              <FolderKanban className="w-3.5 h-3.5" />
              My Projects
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs gap-1">
              <Bell className="w-3.5 h-3.5" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="mt-4">
            <MemberProjectsPanel memberId={user.id} memberName={profile?.full_name || 'User'} />
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

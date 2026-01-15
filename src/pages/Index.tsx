import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { TaskPanel } from '@/components/dashboard/TaskPanel';
import { WorkflowLog } from '@/components/dashboard/WorkflowLog';
import { TaskCRUD } from '@/components/dashboard/TaskCRUD';
import { LeadershipActionPanel } from '@/components/admin/LeadershipActionPanel';
import { AlertTab } from '@/components/alerts/AlertTab';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';

const Index = () => {
  const { user, isLoading, isLeadership, isCaptainOrVice } = useAuth();
  const navigate = useNavigate();
  
  useSessionPersistence();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Mobile-first: Stack everything, Today's Task first */}
        <div className="space-y-4 sm:space-y-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
          {/* Main content - Full width on mobile, 2 cols on desktop */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Today's Task Panel - ALWAYS FIRST on all devices */}
            <TaskPanel />
            
            {/* Workflow Log - Collapsible on mobile */}
            <WorkflowLog />
          </div>
          
          {/* Sidebar - Below main content on mobile */}
          <div className="space-y-4 sm:space-y-6">
            {/* Command Center for TL/VC only */}
            {isCaptainOrVice && <LeadershipActionPanel />}
            
            {/* Alert Tab for leadership */}
            {isLeadership && <AlertTab />}
            
            {/* Task CRUD for leadership */}
            {isLeadership && <TaskCRUD />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

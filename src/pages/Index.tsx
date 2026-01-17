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
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 safe-area-bottom">
        {/* Mobile: Stack layout, Desktop: Grid layout */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main content - Today's Task ALWAYS FIRST */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-1">
            {/* Today's Task Panel - ALWAYS FIRST */}
            <TaskPanel />
            <WorkflowLog />
          </div>
          
          {/* Sidebar - On mobile, shows after main content */}
          <div className="space-y-4 sm:space-y-6 order-2">
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

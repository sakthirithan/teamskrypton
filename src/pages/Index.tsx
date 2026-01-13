import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { TaskPanel } from '@/components/dashboard/TaskPanel';
import { WorkflowLog } from '@/components/dashboard/WorkflowLog';
import { TaskCRUD } from '@/components/dashboard/TaskCRUD';
import { UserManagementPanel } from '@/components/admin/UserManagementPanel';
import { AlertTab } from '@/components/alerts/AlertTab';

const Index = () => {
  const { user, isLoading, isLeadership, isCaptainOrVice, role } = useAuth();
  const navigate = useNavigate();

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
      <main className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <TaskPanel />
            <WorkflowLog />
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Alert Tab for leadership */}
            {isLeadership && <AlertTab />}
            
            {/* Task CRUD for leadership */}
            {isLeadership && <TaskCRUD />}
            
            {/* User Management Panel for TL/VC only */}
            {isCaptainOrVice && <UserManagementPanel />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

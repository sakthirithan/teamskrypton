import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Header } from '@/components/layout/Header';
import { TaskPanel } from '@/components/dashboard/TaskPanel';
import { WorkflowLog } from '@/components/dashboard/WorkflowLog';
import { TaskCRUD } from '@/components/dashboard/TaskCRUD';
import { LeadershipActionPanel } from '@/components/admin/LeadershipActionPanel';
import { AlertTab } from '@/components/alerts/AlertTab';
import { UserListPanel } from '@/components/admin/UserListPanel';
import { TeamMemberDashboard } from '@/components/dashboard/TeamMemberDashboard';
import { StrategistDashboard } from '@/components/dashboard/StrategistDashboard';
import { TeamManagerDashboard } from '@/components/dashboard/TeamManagerDashboard';
import { CaptainDashboard } from '@/components/dashboard/CaptainDashboard';
import { useSessionPersistence } from '@/hooks/useSessionPersistence';

const Index = () => {
  const { user, isLoading, isLeadership, isCaptainOrVice, role } = useAuth();
  const navigate = useNavigate();
  
  useSessionPersistence();

  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [recentActions, setRecentActions] = useState<any[]>([]);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    // Fetch user's tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', user.id)
      .eq('is_test', false);
    
    setMyTasks(tasks || []);

    // Leadership data
    if (isLeadership) {
      const [allTasksRes, membersRes, approvalsRes, actionsRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('is_test', false),
        supabase.from('profiles').select('user_id, full_name').eq('is_test', false),
        supabase.from('approvals').select('*').eq('status', 'pending').eq('is_test', false),
        supabase.from('workflow_log').select('*').eq('is_test', false).order('created_at', { ascending: false }).limit(20)
      ]);

      setAllTasks(allTasksRes.data || []);
      
      // Get roles for members
      const { data: roles } = await supabase.from('user_roles').select('user_id, role');
      const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
      
      setMembers((membersRes.data || []).map(m => ({
        ...m,
        role: roleMap.get(m.user_id) || null
      })));
      
      setApprovals(approvalsRes.data || []);
      
      // Enrich actions with names
      const profileMap = new Map((membersRes.data || []).map(p => [p.user_id, p.full_name]));
      setRecentActions((actionsRes.data || []).map(a => ({
        ...a,
        user_name: profileMap.get(a.user_id) || 'Unknown'
      })));
    }
  }, [user, isLeadership]);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  // Role-specific dashboard component
  const RoleDashboard = () => {
    if (isCaptainOrVice) {
      return <CaptainDashboard tasks={allTasks} members={members} approvals={approvals} recentActions={recentActions} />;
    }
    if (role === 'team_manager') {
      return <TeamManagerDashboard tasks={allTasks} members={members} />;
    }
    if (role === 'strategist') {
      return <StrategistDashboard tasks={allTasks} members={members} />;
    }
    return <TeamMemberDashboard tasks={myTasks} userId={user.id} />;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            <RoleDashboard />
            <TaskPanel />
            <WorkflowLog />
          </div>
          
          {/* Sidebar */}
          <div className="space-y-6">
            {/* Command Center for TL/VC only */}
            {isCaptainOrVice && <LeadershipActionPanel />}
            
            {/* Alert Tab for leadership */}
            {isLeadership && <AlertTab />}
            
            {/* Task CRUD for leadership */}
            {isLeadership && <TaskCRUD />}
            
            {/* User Management for TL/VC only */}
            {isCaptainOrVice && <UserListPanel />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;

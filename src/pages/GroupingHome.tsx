import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { GroupingPanel } from '@/components/grouping/GroupingPanel';
import { TargetActionPanel } from '@/components/grouping/TargetActionPanel';
import { SessionManagementPanel } from '@/components/grouping/SessionManagementPanel';
import { GroupingAlertsPanel } from '@/components/grouping/GroupingAlertsPanel';

const GroupingHome = () => {
  const { user, isLoading, isLeadership, isCaptainOrVice } = useAuth();
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
      <main className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 safe-area-bottom">
        {/* PBL-style layout: Left 2/3, Right 1/3 */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Main content - Grouping Panel */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 order-1">
            <GroupingPanel />
          </div>
          
          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6 order-2">
            {/* Session Management for TL/VC only */}
            {isCaptainOrVice && <SessionManagementPanel />}
            
            {/* Target Action Panel */}
            <TargetActionPanel />
            
            {/* Alerts for leadership */}
            {isLeadership && <GroupingAlertsPanel />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default GroupingHome;

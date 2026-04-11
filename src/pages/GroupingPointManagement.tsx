import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { useAuth } from '@/hooks/useAuth';
import { usePblProjectLead } from '@/components/grouping/LeaderboardPanel';
import { PointsManagementPanel } from '@/components/admin/PointsManagementPanel';

export default function GroupingPointManagement() {
  const { user, isLeadership } = useAuth();
  const { data: isProjectLead } = usePblProjectLead(user?.id);
  const canManagePoints = isLeadership || isProjectLead;

  if (!canManagePoints) {
    return (
      <GroupingLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground text-sm">You do not have permission to access Point Management.</p>
        </div>
      </GroupingLayout>
    );
  }

  return (
    <GroupingLayout>
      <div className="space-y-6 max-w-5xl mx-auto mt-4 px-4 sm:px-6">
        <PointsManagementPanel />
      </div>
    </GroupingLayout>
  );
}

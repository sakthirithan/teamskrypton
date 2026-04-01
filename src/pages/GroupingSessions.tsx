import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { SessionManagementPanel } from '@/components/grouping/SessionManagementPanel';

const GroupingSessions = () => {
  return (
    <GroupingLayout title="Session Management">
      <div className="max-w-3xl">
        <SessionManagementPanel />
      </div>
    </GroupingLayout>
  );
};

export default GroupingSessions;

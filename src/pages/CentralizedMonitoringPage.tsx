import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { CentralizedMonitoringPanel } from '@/components/monitoring/CentralizedMonitoringPanel';
import { useDailyReminderScheduler } from '@/hooks/useDailyReminderScheduler';

const CentralizedMonitoringPage = () => {
  // Mount 6:30 PM reminder scheduler
  useDailyReminderScheduler();

  return (
    <GroupingLayout title="Monitoring & Alerts">
      <CentralizedMonitoringPanel />
    </GroupingLayout>
  );
};

export default CentralizedMonitoringPage;

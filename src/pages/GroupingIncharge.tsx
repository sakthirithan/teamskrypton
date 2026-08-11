import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { InchargePanel } from '@/components/incharge/InchargePanel';

export default function GroupingIncharge() {
  return (
    <GroupingLayout title="Incharge & Schedule">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Incharge & Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Appoint incharges, plan activities on the timeline, and publish the final team schedule.
          </p>
        </div>
        <InchargePanel />
      </div>
    </GroupingLayout>
  );
}

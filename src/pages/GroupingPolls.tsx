import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { PollsPanel } from '@/components/polls/PollsPanel';

export default function GroupingPolls() {
  return (
    <GroupingLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <PollsPanel mode="grouping" />
      </div>
    </GroupingLayout>
  );
}

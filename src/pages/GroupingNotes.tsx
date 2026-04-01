import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { GroupingNotesPanel } from '@/components/grouping/GroupingNotesPanel';

const GroupingNotes = () => {
  return (
    <GroupingLayout title="Notes">
      <GroupingNotesPanel />
    </GroupingLayout>
  );
};

export default GroupingNotes;

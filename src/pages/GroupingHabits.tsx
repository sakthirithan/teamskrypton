import { GroupingLayout } from '@/components/grouping/GroupingLayout';
import { HabitTrackerPanel } from '@/components/grouping/HabitTrackerPanel';

const GroupingHabits = () => {
  return (
    <GroupingLayout title="Habit Tracker">
      <div className="max-w-3xl">
        <HabitTrackerPanel />
      </div>
    </GroupingLayout>
  );
};

export default GroupingHabits;

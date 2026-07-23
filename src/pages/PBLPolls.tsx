import { PBLLayout } from '@/components/pbl/PBLLayout';
import { PollsPanel } from '@/components/polls/PollsPanel';

export default function PBLPolls() {
  return (
    <PBLLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <PollsPanel mode="pbl" />
      </div>
    </PBLLayout>
  );
}

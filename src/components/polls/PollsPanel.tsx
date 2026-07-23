import { useState } from 'react';
import { usePolls, PollMode } from '@/hooks/usePolls';
import { PollCard } from './PollCard';
import { CreatePollDialog } from './CreatePollDialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Vote, Sparkles } from 'lucide-react';

interface Props { mode: PollMode; }

export function PollsPanel({ mode }: Props) {
  const { polls, options, votes, isLoading } = usePolls(mode);
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');

  const visible = polls.filter((p) => {
    const expired = p.deadline && new Date(p.deadline) < new Date();
    const isClosed = p.status === 'closed' || expired;
    if (filter === 'open') return !isClosed;
    if (filter === 'closed') return isClosed;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Vote className="w-6 h-6 text-primary" />Polls & Decisions
          </h1>
          <p className="text-sm text-muted-foreground">Create quick polls, vote from email, and auto-divide teams by preference.</p>
        </div>
        <CreatePollDialog mode={mode} />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">All ({polls.length})</TabsTrigger>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading polls...</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <Sparkles className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium">No polls yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create the first one to gather quick decisions from the team.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {visible.map((p) => <PollCard key={p.id} poll={p} options={options} votes={votes} />)}
        </div>
      )}
    </div>
  );
}

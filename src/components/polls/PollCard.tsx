import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Lock, Trash2, CheckCircle2, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Poll, PollOption, PollVote, usePolls, usePollTeams } from '@/hooks/usePolls';
import { useAuth } from '@/hooks/useAuth';
import { TeamDivisionDialog } from './TeamDivisionDialog';

interface Props {
  poll: Poll;
  options: PollOption[];
  votes: PollVote[];
}

export function PollCard({ poll, options, votes }: Props) {
  const { user } = useAuth();
  const { castVote, removeVote, closePoll, deletePoll } = usePolls(poll.mode);
  const { teams, members } = usePollTeams(poll.id);

  const opts = useMemo(() => options.filter((o) => o.poll_id === poll.id), [options, poll.id]);
  const pollVotes = useMemo(() => votes.filter((v) => v.poll_id === poll.id), [votes, poll.id]);
  const myVotes = pollVotes.filter((v) => v.voter_id === user?.id);
  const totalVoters = new Set(pollVotes.map((v) => v.voter_id)).size;
  const isCreator = user?.id === poll.creator_id;
  const isExpired = poll.deadline && new Date(poll.deadline) < new Date();
  const isClosed = poll.status === 'closed' || isExpired;

  const toggleVote = (optionId: string) => {
    const has = myVotes.some((v) => v.option_id === optionId);
    if (has && poll.allow_multiple) {
      removeVote.mutate({ pollId: poll.id, optionId });
    } else {
      castVote.mutate({ poll, optionId });
    }
  };

  const maxCount = Math.max(1, ...opts.map((o) => pollVotes.filter((v) => v.option_id === o.id).length));

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={isClosed ? 'secondary' : 'default'} className="text-[10px]">
              {isClosed ? <><Lock className="w-3 h-3 mr-1" />Closed</> : 'Open'}
            </Badge>
            {poll.allow_multiple && <Badge variant="outline" className="text-[10px]">Multi-choice</Badge>}
            {poll.deadline && !isClosed && (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />closes {formatDistanceToNow(new Date(poll.deadline), { addSuffix: true })}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-lg">{poll.title}</h3>
          {poll.description && <p className="text-sm text-muted-foreground mt-1">{poll.description}</p>}
        </div>
        {isCreator && (
          <div className="flex gap-1">
            {!isClosed && (
              <Button size="sm" variant="outline" onClick={() => closePoll.mutate(poll.id)}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Close
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => deletePoll.mutate(poll.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {opts.map((o) => {
          const count = pollVotes.filter((v) => v.option_id === o.id).length;
          const pct = totalVoters ? Math.round((count / totalVoters) * 100) : 0;
          const mine = myVotes.some((v) => v.option_id === o.id);
          const showResults = isClosed || poll.results_published || mine;
          return (
            <button
              key={o.id}
              disabled={isClosed}
              onClick={() => toggleVote(o.id)}
              className={`w-full text-left border rounded-lg p-3 transition-all relative overflow-hidden ${
                mine ? 'border-primary bg-primary/5' : 'hover:border-primary/40'
              } ${isClosed ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {showResults && (
                <div
                  className="absolute inset-y-0 left-0 bg-primary/10"
                  style={{ width: `${count === maxCount && count > 0 ? 100 : (count / maxCount) * 100}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {mine && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  <span className="font-medium text-sm">{o.label}</span>
                </div>
                {showResults && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold">{count}</span>
                    <span>({pct}%)</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
        <span>{totalVoters} voter{totalVoters !== 1 ? 's' : ''} · {formatDistanceToNow(new Date(poll.created_at), { addSuffix: true })}</span>
        {isCreator && isClosed && totalVoters >= 2 && (
          <TeamDivisionDialog poll={poll} options={options} votes={votes} />
        )}
      </div>

      {teams.length > 0 && (
        <div className="border-t pt-3">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground">
            <Users className="w-3.5 h-3.5" />TEAMS ({teams.length})
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {teams.map((t: any) => {
              const tm = members.filter((m: any) => m.team_id === t.id);
              return (
                <div key={t.id} className="border rounded p-2 bg-muted/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold">{t.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{tm.length}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

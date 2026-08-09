import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart2, CheckCircle2, Clock, Lock } from 'lucide-react';
import { usePolls, Poll } from '@/hooks/usePolls';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

interface MessengerPollCardProps {
  pollId: string;
  className?: string;
}

export function MessengerPollCard({ pollId, className }: MessengerPollCardProps) {
  const { user } = useAuth();
  const { polls, options, votes, castVote } = usePolls('grouping');

  const poll = polls.find((p) => p.id === pollId);
  const pollOptions = options.filter((o) => o.poll_id === pollId);
  const pollVotes = votes.filter((v) => v.poll_id === pollId);

  if (!poll) {
    return (
      <div className="p-3 text-xs italic text-muted-foreground border border-dashed rounded-xl bg-muted/20">
        Poll record unavailable or expired.
      </div>
    );
  }

  const userVote = pollVotes.find((v) => v.voter_id === user?.id);
  const totalVotes = pollVotes.length;

  // 48-hour expiration check
  const createdAtTime = new Date(poll.created_at).getTime();
  const deadlineTime = poll.deadline ? new Date(poll.deadline).getTime() : createdAtTime + 48 * 60 * 60 * 1000;
  const isExpired = Date.now() >= deadlineTime || poll.status === 'closed';

  return (
    <Card className={`border-primary/20 bg-card/90 shadow-sm rounded-2xl overflow-hidden ${className || ''}`}>
      <div className="p-3.5 bg-primary/5 border-b border-primary/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart2 className="w-4 h-4 text-primary shrink-0" />
          <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">{poll.title}</h4>
        </div>

        {isExpired ? (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 gap-1 shrink-0">
            <Lock className="w-3 h-3 text-muted-foreground" />
            Closed
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400 gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(deadlineTime, { addSuffix: false })} left
          </Badge>
        )}
      </div>

      <CardContent className="p-3.5 space-y-2.5">
        {poll.description && (
          <p className="text-xs text-muted-foreground leading-normal">{poll.description}</p>
        )}

        <div className="space-y-2 pt-1">
          {pollOptions.map((opt) => {
            const optionVotes = pollVotes.filter((v) => v.option_id === opt.id);
            const optVoteCount = optionVotes.length;
            const pct = totalVotes > 0 ? Math.round((optVoteCount / totalVotes) * 100) : 0;
            const isVoted = userVote?.option_id === opt.id;

            return (
              <div
                key={opt.id}
                onClick={() => {
                  if (!isExpired && !castVote.isPending) {
                    castVote.mutate({ pollId: poll.id, optionId: opt.id });
                  }
                }}
                className={`p-2.5 border rounded-xl transition-all relative overflow-hidden ${
                  !isExpired ? 'cursor-pointer hover:border-primary/50' : 'cursor-default'
                } ${
                  isVoted
                    ? 'border-primary bg-primary/10 font-bold'
                    : 'border-border/80 bg-muted/20'
                }`}
              >
                {/* Background Progress Fill */}
                <div
                  className="absolute left-0 top-0 bottom-0 bg-primary/10 transition-all duration-300 pointer-events-none"
                  style={{ width: `${pct}%` }}
                />

                <div className="relative flex items-center justify-between gap-2 z-10">
                  <div className="flex items-center gap-2 min-w-0">
                    {isVoted && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
                    <span className="text-xs text-foreground truncate">{opt.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground shrink-0">
                    <span>{optVoteCount} votes</span>
                    <span className="w-9 text-right font-mono font-bold text-foreground">{pct}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-1 text-[10px] text-muted-foreground font-medium">
          <span>Total Votes: {totalVotes}</span>
          <span>{isExpired ? 'Poll voting closed after 48h' : 'Click option to vote'}</span>
        </div>
      </CardContent>
    </Card>
  );
}

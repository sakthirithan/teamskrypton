import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Lock, Trash2, CheckCircle2, Users, Download, EyeOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Poll, PollOption, PollVote, usePolls, usePollTeams } from '@/hooks/usePolls';
import { useAuth } from '@/hooks/useAuth';
import { TeamDivisionDialog } from './TeamDivisionDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  poll: Poll;
  options: PollOption[];
  votes: PollVote[];
}

export function PollCard({ poll, options, votes }: Props) {
  const { user } = useAuth();
  const { castVote, removeVote, closePoll, deletePoll } = usePolls(poll.mode);
  const { teams, members } = usePollTeams(poll.id);

  const { data: profiles = {} } = useQuery({
    queryKey: ['profiles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email');
      const map: Record<string, { name: string; email: string }> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = { name: p.full_name, email: p.email }; });
      return map;
    },
  });

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

  const exportCSV = () => {
    const rows = [['Team', 'Member', 'Email']];
    for (const t of teams as any[]) {
      const tm = (members as any[]).filter((m) => m.team_id === t.id);
      if (tm.length === 0) rows.push([t.name, '', '']);
      for (const m of tm) {
        const p = (profiles as any)[m.user_id];
        rows.push([t.name, p?.name || m.user_id, p?.email || '']);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${poll.title.replace(/[^a-z0-9]+/gi, '_')}_teams.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success('Teams CSV exported');
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant={isClosed ? 'secondary' : 'default'} className="text-[10px]">
              {isClosed ? <><Lock className="w-3 h-3 mr-1" />Closed</> : 'Open'}
            </Badge>
            {poll.allow_multiple && <Badge variant="outline" className="text-[10px]">Ranked / Multi-choice</Badge>}
            {poll.anonymous && (
              <Badge variant="outline" className="text-[10px]"><EyeOff className="w-3 h-3 mr-1" />Anonymous</Badge>
            )}
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
          const myRank = poll.allow_multiple && mine
            ? myVotes.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .findIndex((v) => v.option_id === o.id) + 1
            : 0;
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
                  {myRank > 0 && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      Rank {myRank}
                    </span>
                  )}
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
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Users className="w-3.5 h-3.5" />TEAMS ({teams.length})
            </div>
            {isCreator && (
              <Button size="sm" variant="ghost" onClick={exportCSV} className="h-7 text-xs">
                <Download className="w-3 h-3 mr-1" />Export CSV
              </Button>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {(teams as any[]).map((t) => {
              const tm = (members as any[]).filter((m) => m.team_id === t.id);
              return (
                <div key={t.id} className="border rounded p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">{t.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{tm.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {tm.length === 0 && <p className="text-[11px] italic text-muted-foreground">No members</p>}
                    {tm.map((m, idx) => {
                      const p = (profiles as any)[m.user_id];
                      const name = p?.name || m.user_id.slice(0, 6);
                      return (
                        <div key={m.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-background">
                          <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-semibold">
                            {idx + 1}
                          </span>
                          <span className="font-medium truncate">{name}</span>
                        </div>
                      );
                    })}
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

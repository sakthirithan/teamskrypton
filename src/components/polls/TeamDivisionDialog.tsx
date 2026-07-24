import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Shuffle, RefreshCw, AlertTriangle } from 'lucide-react';
import { Poll, PollOption, PollVote, usePollTeams } from '@/hooks/usePolls';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface Props {
  poll: Poll;
  options: PollOption[];
  votes: PollVote[];
}

type Team = { name: string; based_on_option_id: string | null; members: string[] };

// Deterministic shuffle using seed
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Preference-based ranked allocation.
 * Each voter's votes ordered by created_at → rank 1, 2, 3, ...
 * Fill teams round-by-rank; respect maxSize; overflow placed in smallest team.
 */
function allocate(
  numTeams: number,
  maxSize: number,
  options: PollOption[],
  votes: PollVote[],
  seed: number,
): { teams: Team[]; overCapacity: boolean; totalVoters: number } {
  const prefs = new Map<string, string[]>();
  const sorted = [...votes].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  for (const v of sorted) {
    const arr = prefs.get(v.voter_id) || [];
    if (!arr.includes(v.option_id)) arr.push(v.option_id);
    prefs.set(v.voter_id, arr);
  }

  // Option popularity → seed team ordering (most popular first)
  const optPopularity = new Map<string, number>();
  for (const o of options) optPopularity.set(o.id, 0);
  for (const [, ranks] of prefs) if (ranks[0]) optPopularity.set(ranks[0], (optPopularity.get(ranks[0]) || 0) + 1);
  const rankedOptions = [...options].sort((a, b) => (optPopularity.get(b.id) || 0) - (optPopularity.get(a.id) || 0));

  const teams: Team[] = [];
  const optToTeam = new Map<string, number>();
  const nameCap = Math.min(numTeams, rankedOptions.length);
  for (let i = 0; i < nameCap; i++) {
    teams.push({ name: rankedOptions[i].label, based_on_option_id: rankedOptions[i].id, members: [] });
    optToTeam.set(rankedOptions[i].id, i);
  }
  for (let i = nameCap; i < numTeams; i++) {
    teams.push({ name: `Team ${i + 1}`, based_on_option_id: null, members: [] });
  }

  const voters = seededShuffle(Array.from(prefs.keys()), seed);
  const placed = new Set<string>();

  // Determine max rank across all voters
  const maxRank = Math.max(1, ...voters.map((v) => (prefs.get(v) || []).length));

  // Round-robin by rank
  for (let rank = 0; rank < maxRank; rank++) {
    for (const uid of voters) {
      if (placed.has(uid)) continue;
      const ranks = prefs.get(uid) || [];
      const optId = ranks[rank];
      if (!optId) continue;
      const ti = optToTeam.get(optId);
      if (ti != null && teams[ti].members.length < maxSize) {
        teams[ti].members.push(uid);
        placed.add(uid);
      }
    }
  }

  // Overflow → smallest team with capacity
  const overflow: string[] = [];
  for (const uid of voters) {
    if (placed.has(uid)) continue;
    let best = -1;
    for (let i = 0; i < teams.length; i++) {
      if (teams[i].members.length >= maxSize) continue;
      if (best === -1 || teams[i].members.length < teams[best].members.length) best = i;
    }
    if (best === -1) { overflow.push(uid); continue; }
    teams[best].members.push(uid);
    placed.add(uid);
  }

  return { teams, overCapacity: overflow.length > 0, totalVoters: prefs.size };
}

export function TeamDivisionDialog({ poll, options, votes }: Props) {
  const [open, setOpen] = useState(false);
  const [numTeams, setNumTeams] = useState(2);
  const [maxSize, setMaxSize] = useState(4);
  const [seed, setSeed] = useState(1);
  const [preview, setPreview] = useState<{ teams: Team[]; overCapacity: boolean; totalVoters: number } | null>(null);
  const { saveDivision } = usePollTeams(poll.id);

  const { data: profiles = {} } = useQuery({
    queryKey: ['profiles-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.full_name; });
      return map;
    },
  });

  const pollVotes = useMemo(() => votes.filter((v) => v.poll_id === poll.id), [votes, poll.id]);
  const pollOpts = useMemo(() => options.filter((o) => o.poll_id === poll.id), [options, poll.id]);
  const voterCount = new Set(pollVotes.map((v) => v.voter_id)).size;

  const generate = (newSeed?: number) => {
    const s = newSeed ?? seed;
    setSeed(s);
    setPreview(allocate(numTeams, maxSize, pollOpts, pollVotes, s));
  };

  const regenerate = () => generate(Math.floor(Math.random() * 100000) + 1);

  const save = async () => {
    if (!preview || preview.overCapacity) return;
    await saveDivision.mutateAsync({ pollId: poll.id, teams: preview.teams });
    setOpen(false); setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Users className="w-3.5 h-3.5 mr-1" />Divide Teams</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shuffle className="w-5 h-5 text-primary" />Preference-Based Team Allocation</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto pr-1">
          <div className="text-xs text-muted-foreground bg-muted/40 border rounded p-3">
            Voters' choices are ranked by their voting order (first click = Rank 1). The algorithm fills each team by top preference up to the max size, then falls back to Rank 2, 3, etc. {voterCount} voter{voterCount !== 1 ? 's' : ''} participated.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Number of teams</Label>
              <Input type="number" min={2} max={20} value={numTeams} onChange={(e) => setNumTeams(Math.max(2, parseInt(e.target.value) || 2))} />
            </div>
            <div>
              <Label>Max team size</Label>
              <Input type="number" min={1} max={50} value={maxSize} onChange={(e) => setMaxSize(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => generate(1)} className="flex-1">Generate</Button>
            {preview && (
              <Button variant="outline" onClick={regenerate}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Re-shuffle
              </Button>
            )}
          </div>

          {preview?.overCapacity && (
            <div className="flex items-start gap-2 border border-amber-500/40 bg-amber-500/10 rounded p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-amber-700">Capacity exceeded</div>
                <div className="text-xs text-amber-700/80">
                  {preview.totalVoters} voters can't fit in {numTeams} teams × {maxSize} = {numTeams * maxSize} slots. Increase team count or max size.
                </div>
              </div>
            </div>
          )}

          {preview && (
            <div className="grid gap-3 sm:grid-cols-2">
              {preview.teams.map((t, i) => (
                <div key={i} className="border rounded-md p-3 bg-muted/20">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">{t.name}</h4>
                    <Badge variant={t.members.length >= maxSize ? 'default' : 'secondary'}>
                      {t.members.length}/{maxSize}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {t.members.length === 0 && <p className="text-xs text-muted-foreground italic">No members</p>}
                    {t.members.map((uid, idx) => (
                      <div key={uid} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-background">
                        <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] flex items-center justify-center font-semibold">
                          {idx + 1}
                        </span>
                        <span className="font-medium">{profiles[uid] || uid.slice(0, 6)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={!preview || preview.overCapacity || saveDivision.isPending}>
            {saveDivision.isPending ? 'Saving...' : 'Save Teams'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

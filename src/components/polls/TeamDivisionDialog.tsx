import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Shuffle } from 'lucide-react';
import { Poll, PollOption, PollVote, usePollTeams } from '@/hooks/usePolls';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface Props {
  poll: Poll;
  options: PollOption[];
  votes: PollVote[];
}

// Balanced allocation: distribute voters preferring their top choice, balance sizes.
function allocate(numTeams: number, options: PollOption[], votes: PollVote[]): { name: string; based_on_option_id: string | null; members: string[] }[] {
  // Build voter -> preferred option ids (by vote order — first vote = top choice)
  const prefs = new Map<string, string[]>();
  const sorted = [...votes].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  for (const v of sorted) {
    const arr = prefs.get(v.voter_id) || [];
    if (!arr.includes(v.option_id)) arr.push(v.option_id);
    prefs.set(v.voter_id, arr);
  }

  const teams: { name: string; based_on_option_id: string | null; members: string[] }[] = [];
  if (numTeams >= options.length) {
    // Teams named after options
    for (const o of options) teams.push({ name: o.label, based_on_option_id: o.id, members: [] });
    for (let i = options.length; i < numTeams; i++) teams.push({ name: `Team ${i + 1}`, based_on_option_id: null, members: [] });
  } else {
    for (let i = 0; i < numTeams; i++) teams.push({ name: `Team ${i + 1}`, based_on_option_id: null, members: [] });
  }

  const target = Math.ceil(prefs.size / numTeams);
  const optToTeam = new Map<string, number>();
  teams.forEach((t, i) => { if (t.based_on_option_id) optToTeam.set(t.based_on_option_id, i); });

  const voters = Array.from(prefs.keys());
  for (const uid of voters) {
    const pref = prefs.get(uid) || [];
    let placed = false;
    for (const opt of pref) {
      const ti = optToTeam.get(opt);
      if (ti != null && teams[ti].members.length < target) {
        teams[ti].members.push(uid); placed = true; break;
      }
    }
    if (!placed) {
      // put in smallest team
      let min = 0;
      for (let i = 1; i < teams.length; i++) if (teams[i].members.length < teams[min].members.length) min = i;
      teams[min].members.push(uid);
    }
  }
  return teams;
}

export function TeamDivisionDialog({ poll, options, votes }: Props) {
  const [open, setOpen] = useState(false);
  const [numTeams, setNumTeams] = useState(2);
  const [preview, setPreview] = useState<ReturnType<typeof allocate> | null>(null);
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

  const generate = () => setPreview(allocate(numTeams, pollOpts, pollVotes));

  const save = async () => {
    if (!preview) return;
    await saveDivision.mutateAsync({ pollId: poll.id, teams: preview });
    setOpen(false); setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Users className="w-3.5 h-3.5 mr-1" />Divide Teams</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shuffle className="w-5 h-5 text-primary" />Team Division</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            The algorithm groups voters by their preferences and balances team sizes. Runs on {new Set(pollVotes.map((v) => v.voter_id)).size} voters.
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Number of teams</Label>
              <Input type="number" min={2} max={20} value={numTeams} onChange={(e) => setNumTeams(Math.max(2, parseInt(e.target.value) || 2))} />
            </div>
            <Button onClick={generate}>Generate</Button>
          </div>
          {preview && (
            <div className="grid gap-3 sm:grid-cols-2 max-h-96 overflow-auto">
              {preview.map((t, i) => (
                <div key={i} className="border rounded-md p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">{t.name}</h4>
                    <Badge variant="secondary">{t.members.length}</Badge>
                  </div>
                  <div className="space-y-1">
                    {t.members.length === 0 && <p className="text-xs text-muted-foreground italic">No members</p>}
                    {t.members.map((uid) => (
                      <div key={uid} className="text-xs px-2 py-1 rounded bg-background">{profiles[uid] || uid.slice(0, 6)}</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={!preview || saveDivision.isPending}>Save Teams</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

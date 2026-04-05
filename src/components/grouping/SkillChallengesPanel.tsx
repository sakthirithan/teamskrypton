import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Swords, Plus, Check, Clock, X, Send, Users, Zap, 
  BookOpen, Flame, Shield, Trash2, CheckCircle2, XCircle 
} from 'lucide-react';
import { useSkillChallenges } from '@/hooks/useSkillChallenges';
import { useSkillLevels, XP_REWARDS, getLevelFromXp } from '@/hooks/useSkillLevels';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface SkillChallengesPanelProps {
  sessionId: string;
}

export function SkillChallengesPanel({ sessionId }: SkillChallengesPanelProps) {
  const { user, isLeadership } = useAuth();
  const { toast } = useToast();
  const { 
    challenges, completions, createChallenge, submitCompletion, 
    approveCompletion, deleteChallenge, getUserCompletion, getCompletionsForChallenge 
  } = useSkillChallenges(sessionId);
  const { awardXp } = useSkillLevels(sessionId, user?.id);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitChallengeId, setSubmitChallengeId] = useState<string | null>(null);
  const [proofText, setProofText] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    xp_reward: 50,
    difficulty: 'medium',
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-challenges'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').eq('is_test', false);
      return data || [];
    },
  });

  const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    await createChallenge.mutateAsync(form);
    setForm({ title: '', description: '', xp_reward: 50, difficulty: 'medium' });
    setIsCreateOpen(false);
    toast({ title: 'Challenge Created!' });
  };

  const handleSubmit = async (challengeId: string) => {
    await submitCompletion.mutateAsync({ challengeId, proofText: proofText.trim() });
    setSubmitChallengeId(null);
    setProofText('');
    toast({ title: 'Submission Sent', description: 'Leadership will review your completion.' });
  };

  const handleApprove = async (completionId: string, challengeXp: number, completionUserId: string) => {
    await approveCompletion.mutateAsync({ completionId, approve: true });
    // Award XP to the completing user
    // Note: XP is awarded to the user who completed, not the approver
    // We use a direct insert since the awardXp hook is for current user
    await supabase.from('skill_xp_log' as any).insert({
      user_id: completionUserId,
      session_id: sessionId,
      xp_amount: challengeXp,
      activity_type: 'challenge_medium',
      description: 'Challenge completed',
    } as any);

    // Update their level
    const { data: levelData } = await supabase
      .from('skill_levels' as any)
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', completionUserId)
      .maybeSingle();

    const currentXp = (levelData as any)?.xp || 0;
    const newXp = currentXp + challengeXp;
    const newLevel = Math.max(1, Math.min(10, Math.floor(newXp / 200) + 1));

    if (levelData) {
      await supabase.from('skill_levels' as any)
        .update({ xp: newXp, level: newLevel } as any)
        .eq('id', (levelData as any).id);
    } else {
      await supabase.from('skill_levels' as any)
        .insert({ user_id: completionUserId, session_id: sessionId, xp: newXp, level: newLevel } as any);
    }

    toast({ title: 'Approved!', description: `+${challengeXp} XP awarded.` });
  };

  const handleReject = async (completionId: string) => {
    await approveCompletion.mutateAsync({ completionId, approve: false });
    toast({ title: 'Rejected' });
  };

  const difficultyConfig: Record<string, { icon: any; color: string; label: string }> = {
    easy: { icon: BookOpen, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20', label: 'Easy' },
    medium: { icon: Flame, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20', label: 'Medium' },
    hard: { icon: Shield, color: 'text-red-600 bg-red-500/10 border-red-500/20', label: 'Hard' },
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <Swords className="w-4 h-4 text-primary" />
              Skill Challenges
              {challenges.length > 0 && (
                <Badge variant="secondary" className="text-xs tabular-nums">{challenges.length}</Badge>
              )}
            </span>
            {isLeadership && (
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="w-3.5 h-3.5 mr-1" /> New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Skill Challenge</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>Challenge Title</Label>
                      <Input
                        value={form.title}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder="e.g., Build a REST API endpoint"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={form.description}
                        onChange={e => setForm({ ...form, description: e.target.value })}
                        placeholder="Describe the challenge requirements..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Difficulty</Label>
                        <Select value={form.difficulty} onValueChange={v => {
                          const xp = v === 'easy' ? 30 : v === 'hard' ? 100 : 50;
                          setForm({ ...form, difficulty: v, xp_reward: xp });
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="easy">🟢 Easy (30 XP)</SelectItem>
                            <SelectItem value="medium">🟡 Medium (50 XP)</SelectItem>
                            <SelectItem value="hard">🔴 Hard (100 XP)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>XP Reward</Label>
                        <Input
                          type="number"
                          value={form.xp_reward}
                          onChange={e => setForm({ ...form, xp_reward: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <Button onClick={handleCreate} className="w-full" disabled={createChallenge.isPending || !form.title.trim()}>
                      {createChallenge.isPending ? 'Creating...' : 'Create Challenge'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Challenge List */}
      {challenges.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Swords className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm font-medium">No challenges yet</p>
            <p className="text-xs mt-1">
              {isLeadership ? 'Create challenges to motivate skill development!' : 'Leadership will post challenges soon.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[500px]">
          <div className="space-y-2 pr-1">
            {challenges.map(challenge => {
              const diff = difficultyConfig[challenge.difficulty] || difficultyConfig.medium;
              const DiffIcon = diff.icon;
              const myCompletion = getUserCompletion(challenge.id);
              const allCompletions = getCompletionsForChallenge(challenge.id);
              const isCompleted = myCompletion?.status === 'approved';
              const isPending = myCompletion?.status === 'pending';
              const pendingReviews = allCompletions.filter(c => c.status === 'pending');

              return (
                <Card key={challenge.id} className={`transition-colors ${isCompleted ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{challenge.title}</p>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${diff.color}`}>
                            <DiffIcon className="w-2.5 h-2.5 mr-0.5" />
                            {diff.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary bg-primary/10 border-primary/20">
                            <Zap className="w-2.5 h-2.5 mr-0.5" />
                            {challenge.xp_reward} XP
                          </Badge>
                        </div>
                        {challenge.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{challenge.description}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(challenge.created_at), { addSuffix: true })}
                          {allCompletions.length > 0 && (
                            <span className="ml-2">• {allCompletions.filter(c => c.status === 'approved').length} completed</span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isCompleted && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                            <Check className="w-2.5 h-2.5 mr-0.5" /> Done
                          </Badge>
                        )}
                        {isPending && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-600 bg-amber-500/10">
                            <Clock className="w-2.5 h-2.5 mr-0.5" /> Pending
                          </Badge>
                        )}
                        {!myCompletion && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => { setSubmitChallengeId(challenge.id); setProofText(''); }}
                          >
                            <Send className="w-3 h-3 mr-1" /> Submit
                          </Button>
                        )}
                        {isLeadership && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-destructive"
                            onClick={() => deleteChallenge.mutate(challenge.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Pending Reviews (Leadership) */}
                    {isLeadership && pendingReviews.length > 0 && (
                      <div className="mt-2 pt-2 border-t space-y-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground">Pending Reviews ({pendingReviews.length})</p>
                        {pendingReviews.map(comp => (
                          <div key={comp.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40 text-xs">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{profileMap.get(comp.user_id) || 'Unknown'}</p>
                              {comp.proof_text && (
                                <p className="text-muted-foreground truncate">{comp.proof_text}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-emerald-600"
                                onClick={() => handleApprove(comp.id, challenge.xp_reward, comp.user_id)}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive"
                                onClick={() => handleReject(comp.id)}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Submit Proof Dialog */}
      <Dialog open={!!submitChallengeId} onOpenChange={o => !o && setSubmitChallengeId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Submit Challenge Completion</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-2">
              <Label>Proof / Description (optional)</Label>
              <Textarea
                value={proofText}
                onChange={e => setProofText(e.target.value)}
                placeholder="Describe what you did, share a link, or explain your approach..."
                className="min-h-[80px]"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => submitChallengeId && handleSubmit(submitChallengeId)}
              disabled={submitCompletion.isPending}
            >
              {submitCompletion.isPending ? 'Submitting...' : 'Submit for Review'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

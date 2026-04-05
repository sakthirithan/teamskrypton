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
  Swords, Plus, Check, Clock, Send, Zap, 
  BookOpen, Flame, Shield, Trash2, CheckCircle2, XCircle, Users
} from 'lucide-react';
import { useSkillChallenges } from '@/hooks/useSkillChallenges';
import { getLevelFromXp } from '@/hooks/useSkillLevels';
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
  const queryClient = useQueryClient();
  const { 
    challenges, createChallenge, submitCompletion, 
    approveCompletion, deleteChallenge, getUserCompletion, getCompletionsForChallenge 
  } = useSkillChallenges(sessionId);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitChallengeId, setSubmitChallengeId] = useState<string | null>(null);
  const [proofText, setProofText] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [assignMode, setAssignMode] = useState<'all' | 'select' | 'skill'>('all');
  
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

  const { data: memberSkills = [] } = useQuery({
    queryKey: ['member-skills-for-challenges'],
    queryFn: async () => {
      const { data } = await supabase.from('member_skills').select('user_id, skill_name');
      return data || [];
    },
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ['user-roles-for-challenges'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id, role');
      return data || [];
    },
  });

  const profileMap = new Map(profiles.map(p => [p.user_id, p.full_name]));
  const roleMap = new Map(userRoles.map(r => [r.user_id, r.role]));
  const uniqueSkillNames = [...new Set(memberSkills.map(s => s.skill_name))].sort();

  const toggleMember = (userId: string) => {
    setSelectedMembers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectBySkill = (skillName: string) => {
    const userIds = memberSkills.filter(s => s.skill_name === skillName).map(s => s.user_id);
    setSelectedMembers([...new Set([...selectedMembers, ...userIds])]);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    await createChallenge.mutateAsync(form);
    
    // If specific members selected, assign them
    if (assignMode !== 'all' && selectedMembers.length > 0) {
      // Get the newly created challenge ID
      const { data: latestChallenges } = await supabase
        .from('skill_challenges' as any)
        .select('id')
        .eq('session_id', sessionId)
        .eq('title', form.title)
        .order('created_at', { ascending: false })
        .limit(1);
      
      const challengeId = (latestChallenges as any)?.[0]?.id;
      if (challengeId) {
        const rows = selectedMembers.map(uid => ({ challenge_id: challengeId, user_id: uid }));
        await supabase.from('challenge_assignments' as any).insert(rows as any);
        
        // Send notification to each assigned member
        if (user) {
          const notifications = selectedMembers.map(uid => ({
            sender_id: user.id,
            recipient_id: uid,
            title: '⚔️ New Skill Challenge Assigned',
            message: `You've been assigned: "${form.title}" (${form.xp_reward} XP)`,
            type: 'challenge',
            session_id: sessionId,
          }));
          await supabase.from('grouping_notifications').insert(notifications);
        }
      }
    }

    setForm({ title: '', description: '', xp_reward: 50, difficulty: 'medium' });
    setSelectedMembers([]);
    setAssignMode('all');
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
    try {
      await approveCompletion.mutateAsync({ completionId, approve: true });
      
      // Insert XP log entry for the completing user
      const { error: logError } = await supabase.from('skill_xp_log' as any).insert({
        user_id: completionUserId,
        session_id: sessionId,
        xp_amount: challengeXp,
        activity_type: 'challenge_approved',
        description: 'Challenge completion approved',
        completion_id: completionId,
      } as any);
      if (logError) console.error('XP log insert error:', logError);

      // Upsert skill level for the completing user
      const { data: levelData } = await supabase
        .from('skill_levels' as any)
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', completionUserId)
        .maybeSingle();

      const currentXp = (levelData as any)?.xp || 0;
      const newXp = currentXp + challengeXp;
      const newLevel = getLevelFromXp(newXp);

      if (levelData) {
        await supabase.from('skill_levels' as any)
          .update({ xp: newXp, level: newLevel, updated_at: new Date().toISOString() } as any)
          .eq('id', (levelData as any).id);
      } else {
        await supabase.from('skill_levels' as any)
          .insert({ user_id: completionUserId, session_id: sessionId, xp: newXp, level: newLevel } as any);
      }

      // Invalidate all related caches so UI updates everywhere
      queryClient.invalidateQueries({ queryKey: ['skill-level'] });
      queryClient.invalidateQueries({ queryKey: ['skill-xp-log'] });
      queryClient.invalidateQueries({ queryKey: ['skill-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['skill-challenge-completions'] });

      toast({ title: 'Approved!', description: `+${challengeXp} XP awarded.` });
    } catch (err: any) {
      console.error('Approval error:', err);
      toast({ variant: 'destructive', title: 'Error', description: err.message || 'Failed to approve' });
    }
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

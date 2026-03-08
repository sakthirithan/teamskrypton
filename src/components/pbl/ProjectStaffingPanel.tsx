import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAllProfiles, ProjectMember } from '@/hooks/useProjects';
import { useMemberSkills, MemberSkill } from '@/hooks/useMemberSkills';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, UserPlus, Briefcase, Search, BarChart3, 
  PieChart, Star, X, Save, Loader2 
} from 'lucide-react';

interface ProjectStaffingPanelProps {
  projectId: string;
  members: (ProjectMember & { full_name: string; share_percentage?: number; role_label?: string })[];
}

function SkillMatchScore({ userId, requiredSkills }: { userId: string; requiredSkills: string[] }) {
  const { skills } = useMemberSkills(userId);
  const matched = skills.filter(s => 
    requiredSkills.some(rs => s.skill_name.toLowerCase().includes(rs.toLowerCase()))
  );
  const score = requiredSkills.length > 0 ? Math.round((matched.length / requiredSkills.length) * 100) : 0;

  return (
    <div className="flex items-center gap-1.5">
      <Progress value={score} className="h-1.5 w-16" />
      <span className="text-[10px] text-muted-foreground">{score}%</span>
    </div>
  );
}

export function ProjectStaffingPanel({ projectId, members }: ProjectStaffingPanelProps) {
  const { user, isCaptainOrVice } = useAuth();
  const { data: allProfiles = [] } = useAllProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchSkill, setSearchSkill] = useState('');
  const [showHire, setShowHire] = useState(false);
  const [shares, setShares] = useState<Record<string, { percentage: number; role_label: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize shares from members
  useMemo(() => {
    const initial: Record<string, { percentage: number; role_label: string }> = {};
    members.forEach(m => {
      initial[m.user_id] = {
        percentage: (m as any).share_percentage || 0,
        role_label: (m as any).role_label || '',
      };
    });
    setShares(initial);
  }, [members]);

  // Fetch all member skills for matching
  const { data: allSkills = [] } = useQuery({
    queryKey: ['all-member-skills'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_skills')
        .select('*')
        .order('skill_type')
        .order('skill_name');
      if (error) throw error;
      return data as MemberSkill[];
    },
  });

  // All project members across all projects for workload
  const { data: allProjectMembers = [] } = useQuery({
    queryKey: ['all-project-members-workload'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select('*');
      if (error) throw error;
      return data || [];
    },
  });

  // Non-members with skill search
  const nonMembers = useMemo(() => {
    const memberIds = new Set(members.map(m => m.user_id));
    let candidates = allProfiles.filter(p => !memberIds.has(p.user_id));
    
    if (searchSkill.trim()) {
      const q = searchSkill.toLowerCase();
      const matchingUserIds = new Set(
        allSkills
          .filter(s => s.skill_name.toLowerCase().includes(q))
          .map(s => s.user_id)
      );
      candidates = candidates.filter(c => matchingUserIds.has(c.user_id));
    }
    
    return candidates;
  }, [allProfiles, members, allSkills, searchSkill]);

  // Workload per member
  const workloadMap = useMemo(() => {
    const map = new Map<string, number>();
    allProjectMembers.forEach(pm => {
      map.set(pm.user_id, (map.get(pm.user_id) || 0) + 1);
    });
    return map;
  }, [allProjectMembers]);

  const totalShares = Object.values(shares).reduce((sum, s) => sum + s.percentage, 0);

  // Add member to project
  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('project_members')
        .insert({ project_id: projectId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast({ title: 'Member added to project' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  // Save shares (TL only)
  const handleSaveShares = async () => {
    if (!isCaptainOrVice) return;
    setIsSaving(true);
    try {
      for (const member of members) {
        const share = shares[member.user_id];
        if (share) {
          await supabase
            .from('project_members')
            .update({
              share_percentage: share.percentage,
              role_label: share.role_label || null,
            } as any)
            .eq('id', member.id);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast({ title: 'Shares saved successfully' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Team Composition & Shares */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              Team Composition & Shares
            </span>
            <div className="flex items-center gap-2">
              {totalShares > 0 && (
                <Badge variant={totalShares === 100 ? 'default' : 'secondary'} className="text-[10px]">
                  {totalShares}% allocated
                </Badge>
              )}
              {isCaptainOrVice && (
                <Button size="sm" variant="outline" onClick={handleSaveShares} disabled={isSaving} className="h-7 text-xs">
                  {isSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                  Save
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No team members yet.</p>
          ) : (
            <ScrollArea className="max-h-[350px]">
              <div className="space-y-3 pr-1">
                {members.map(m => {
                  const share = shares[m.user_id] || { percentage: 0, role_label: '' };
                  const workload = workloadMap.get(m.user_id) || 0;

                  return (
                    <div key={m.id} className="p-3 rounded-lg border bg-card/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                            {m.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{m.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {workload} project{workload !== 1 ? 's' : ''} active
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {share.percentage}%
                        </Badge>
                      </div>

                      {isCaptainOrVice && (
                        <div className="flex gap-2 mt-2">
                          <Input
                            placeholder="Role (e.g., Frontend Lead)"
                            value={share.role_label}
                            onChange={e => setShares(prev => ({
                              ...prev,
                              [m.user_id]: { ...prev[m.user_id], role_label: e.target.value },
                            }))}
                            className="h-7 text-xs flex-1"
                          />
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={share.percentage}
                            onChange={e => setShares(prev => ({
                              ...prev,
                              [m.user_id]: { ...prev[m.user_id], percentage: parseInt(e.target.value) || 0 },
                            }))}
                            className="h-7 text-xs w-16"
                          />
                        </div>
                      )}

                      {!isCaptainOrVice && share.role_label && (
                        <Badge variant="secondary" className="text-[10px] mt-1">{share.role_label}</Badge>
                      )}

                      {/* Workload bar */}
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                          <span>Workload</span>
                          <span>{workload} project{workload !== 1 ? 's' : ''}</span>
                        </div>
                        <Progress value={Math.min(100, workload * 20)} className="h-1" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Skill-Match Hiring */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-primary" />
              Skill-Match Hiring
            </span>
            <Button size="sm" variant="outline" onClick={() => setShowHire(!showHire)} className="h-7 text-xs">
              {showHire ? 'Close' : 'Find Specialists'}
            </Button>
          </CardTitle>
        </CardHeader>
        {showHire && (
          <CardContent>
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  placeholder="Search by skill (e.g., React, AI, Python)..."
                  value={searchSkill}
                  onChange={e => setSearchSkill(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 pr-1">
                  {nonMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {searchSkill ? 'No matching specialists found.' : 'All members are already in this project.'}
                    </p>
                  ) : (
                    nonMembers.map(p => {
                      const memberSkills = allSkills.filter(s => s.user_id === p.user_id);
                      const workload = workloadMap.get(p.user_id) || 0;

                      return (
                        <div key={p.user_id} className="p-2.5 rounded-lg border hover:border-primary/30 hover:bg-accent/5 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                {p.full_name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-xs font-medium">{p.full_name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {p.department} · {workload} project{workload !== 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 text-[10px] px-2"
                              onClick={() => addMember.mutate(p.user_id)}
                              disabled={addMember.isPending}
                            >
                              <UserPlus className="w-3 h-3 mr-1" />
                              Hire
                            </Button>
                          </div>
                          {memberSkills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5 ml-8">
                              {memberSkills.map(s => (
                                <Badge
                                  key={s.id}
                                  variant="outline"
                                  className={`text-[9px] px-1 py-0 ${
                                    s.skill_type === 'primary' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20' :
                                    s.skill_type === 'secondary' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20' :
                                    'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20'
                                  }`}
                                >
                                  {s.skill_name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

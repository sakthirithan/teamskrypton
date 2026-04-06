import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAllProfiles, ProjectMember } from '@/hooks/useProjects';
import { useMemberSkills, MemberSkill } from '@/hooks/useMemberSkills';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Users, UserPlus, Briefcase, Search, PieChart, Star,
  Save, Loader2, TrendingUp, Award, ChevronRight
} from 'lucide-react';

interface ProjectStaffingPanelProps {
  projectId: string;
  members: (ProjectMember & { full_name: string; share_percentage?: number; role_label?: string })[];
  isProjectLead?: boolean;
}

function SkillBadge({ skill }: { skill: MemberSkill }) {
  const colors: Record<string, string> = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    secondary: 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20',
    specialization: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${colors[skill.skill_type] || ''}`}>
      {skill.skill_name}
    </Badge>
  );
}

export function ProjectStaffingPanel({ projectId, members, isProjectLead = false }: ProjectStaffingPanelProps) {
  const { user, isCaptainOrVice } = useAuth();
  const canManage = isCaptainOrVice || isProjectLead;
  const { data: allProfiles = [] } = useAllProfiles();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchSkill, setSearchSkill] = useState('');
  const [shares, setShares] = useState<Record<string, { percentage: number; role_label: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Initialize shares from members
  useEffect(() => {
    const initial: Record<string, { percentage: number; role_label: string }> = {};
    members.forEach(m => {
      initial[m.user_id] = {
        percentage: (m as any).share_percentage || 0,
        role_label: (m as any).role_label || '',
      };
    });
    setShares(initial);
  }, [members]);

  const { data: allSkills = [] } = useQuery({
    queryKey: ['all-member-skills'],
    queryFn: async () => {
      const { data, error } = await supabase.from('member_skills').select('*').order('skill_type').order('skill_name');
      if (error) throw error;
      return data as MemberSkill[];
    },
  });

  const { data: allProjectMembers = [] } = useQuery({
    queryKey: ['all-project-members-workload'],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_members').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const nonMembers = useMemo(() => {
    const memberIds = new Set(members.map(m => m.user_id));
    let candidates = allProfiles.filter(p => !memberIds.has(p.user_id));
    if (searchSkill.trim()) {
      const q = searchSkill.toLowerCase();
      const matchingUserIds = new Set(allSkills.filter(s => s.skill_name.toLowerCase().includes(q)).map(s => s.user_id));
      candidates = candidates.filter(c => matchingUserIds.has(c.user_id));
    }
    return candidates;
  }, [allProfiles, members, allSkills, searchSkill]);

  const workloadMap = useMemo(() => {
    const map = new Map<string, number>();
    allProjectMembers.forEach(pm => map.set(pm.user_id, (map.get(pm.user_id) || 0) + 1));
    return map;
  }, [allProjectMembers]);

  const totalShares = Object.values(shares).reduce((sum, s) => sum + s.percentage, 0);

  const addMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('project_members').insert({ project_id: projectId, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-members', projectId] });
      toast({ title: 'Member added to project' });
    },
    onError: (e: any) => toast({ variant: 'destructive', title: 'Error', description: e.message }),
  });

  const handleSaveShares = async () => {
    if (!canManage) return;
    setIsSaving(true);
    try {
      for (const member of members) {
        const share = shares[member.user_id];
        if (share) {
          await supabase.from('project_members').update({
            share_percentage: share.percentage,
            role_label: share.role_label || null,
          } as any).eq('id', member.id);
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
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-primary/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{members.length}</p>
              <p className="text-[11px] text-muted-foreground">Team Size</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[hsl(var(--success))]/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center">
              <PieChart className="w-5 h-5 text-[hsl(var(--success))]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalShares}%</p>
              <p className="text-[11px] text-muted-foreground">Allocated</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[hsl(var(--warning))]/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[hsl(var(--warning))]/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-[hsl(var(--warning))]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{nonMembers.length}</p>
              <p className="text-[11px] text-muted-foreground">Available</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Award className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{allSkills.length}</p>
              <p className="text-[11px] text-muted-foreground">Total Skills</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Sections */}
      <Tabs defaultValue="team" className="w-full">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="team" className="flex items-center gap-1.5 text-xs">
            <PieChart className="w-3.5 h-3.5" />
            Team & Shares
          </TabsTrigger>
          <TabsTrigger value="hiring" className="flex items-center gap-1.5 text-xs">
            <UserPlus className="w-3.5 h-3.5" />
            Find Specialists
          </TabsTrigger>
        </TabsList>

        {/* Team & Shares Tab */}
        <TabsContent value="team" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-primary" />
                    Team Composition
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Manage roles and contribution shares for team members
                  </CardDescription>
                </div>
                {canManage && (
                  <Button size="sm" onClick={handleSaveShares} disabled={isSaving} className="h-8 text-xs gap-1.5">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Changes
                  </Button>
                )}
              </div>
              {totalShares > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Share Allocation</span>
                    <span className={`font-semibold ${totalShares === 100 ? 'text-[hsl(var(--success))]' : totalShares > 100 ? 'text-destructive' : 'text-[hsl(var(--warning))]'}`}>
                      {totalShares}% / 100%
                    </span>
                  </div>
                  <Progress value={Math.min(100, totalShares)} className="h-2" />
                </div>
              )}
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No team members yet</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Add members from the "Find Specialists" tab</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[420px]">
                  <div className="space-y-3 pr-1">
                    {members.map(m => {
                      const share = shares[m.user_id] || { percentage: 0, role_label: '' };
                      const workload = workloadMap.get(m.user_id) || 0;
                      const memberSkills = allSkills.filter(s => s.user_id === m.user_id);

                      return (
                        <div key={m.id} className="p-4 rounded-xl border bg-card hover:shadow-sm transition-all duration-200">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary text-sm font-bold ring-2 ring-primary/10">
                                {m.full_name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{m.full_name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {share.role_label && !canManage && (
                                    <Badge variant="secondary" className="text-[10px] h-4">{share.role_label}</Badge>
                                  )}
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Briefcase className="w-3 h-3" />
                                    {workload} project{workload !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold text-primary">{share.percentage}%</span>
                              <p className="text-[10px] text-muted-foreground">share</p>
                            </div>
                          </div>

                          {/* Skills */}
                          {memberSkills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3 ml-12">
                              {memberSkills.slice(0, 5).map(s => <SkillBadge key={s.id} skill={s} />)}
                              {memberSkills.length > 5 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{memberSkills.length - 5}</Badge>
                              )}
                            </div>
                          )}

                          {/* Workload bar */}
                          <div className="mt-3 ml-12">
                            <Progress value={Math.min(100, workload * 20)} className="h-1.5" />
                          </div>

                          {/* Edit fields for lead or leadership */}
                          {canManage && (
                            <div className="flex gap-2 mt-3 ml-12">
                              <Input
                                placeholder="Role label (e.g., Frontend Lead)"
                                value={share.role_label}
                                onChange={e => setShares(prev => ({
                                  ...prev,
                                  [m.user_id]: { ...prev[m.user_id], role_label: e.target.value },
                                }))}
                                className="h-8 text-xs flex-1"
                              />
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                placeholder="%"
                                value={share.percentage}
                                onChange={e => setShares(prev => ({
                                  ...prev,
                                  [m.user_id]: { ...prev[m.user_id], percentage: parseInt(e.target.value) || 0 },
                                }))}
                                className="h-8 text-xs w-20"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Find Specialists Tab */}
        <TabsContent value="hiring" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                Skill-Match Hiring
              </CardTitle>
              <CardDescription className="text-xs">
                Search by skill to find the best specialists for your project
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by skill (e.g., React, AI, Python)..."
                    value={searchSkill}
                    onChange={e => setSearchSkill(e.target.value)}
                    className="pl-10 h-10"
                  />
                </div>

                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2 pr-1">
                    {nonMembers.length === 0 ? (
                      <div className="text-center py-8">
                        <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">
                          {searchSkill ? 'No matching specialists found' : 'All members are already in this project'}
                        </p>
                      </div>
                    ) : (
                      nonMembers.map(p => {
                        const memberSkills = allSkills.filter(s => s.user_id === p.user_id);
                        const workload = workloadMap.get(p.user_id) || 0;

                        return (
                          <div key={p.user_id} className="p-3.5 rounded-xl border hover:border-primary/30 hover:shadow-sm transition-all duration-200 group">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground text-sm font-bold">
                                  {p.full_name.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold group-hover:text-primary transition-colors">{p.full_name}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {p.department} · {workload} active project{workload !== 1 ? 's' : ''}
                                  </p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="h-8 text-xs gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity"
                                onClick={() => addMember.mutate(p.user_id)}
                                disabled={addMember.isPending}
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                Hire
                              </Button>
                            </div>
                            {memberSkills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2.5 ml-12">
                                {memberSkills.map(s => <SkillBadge key={s.id} skill={s} />)}
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
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Trash2, Pencil, Sparkles, GraduationCap, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  useMemberSkills, 
  SKILL_TYPE_LABELS, 
  SKILL_TYPE_LIMITS, 
  DOMAIN_OPTIONS,
  SKILL_TO_DOMAIN_MAP,
  getEffectiveDomain,
  SkillType, 
  MemberSkill 
} from '@/hooks/useMemberSkills';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface SkillAssignmentPanelProps {
  userId: string;
  userName: string;
  isSelfMode?: boolean;
}

function getSkillTypeColor(type: SkillType): string {
  switch (type) {
    case 'primary': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    case 'secondary': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    case 'specialization': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
  }
}

export function SkillAssignmentPanel({ userId, userName, isSelfMode = false }: SkillAssignmentPanelProps) {
  const { user, isLeadership } = useAuth();
  const { toast } = useToast();
  const { skills, allSkills, assignSkill, updateSkill, removeSkill } = useMemberSkills(userId);
  const [isOpen, setIsOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<MemberSkill | null>(null);
  const [skillName, setSkillName] = useState('');
  const [skillType, setSkillType] = useState<SkillType>('primary');
  const [domain, setDomain] = useState<string>('General');
  const [customDomain, setCustomDomain] = useState('');

  // Scroll Container States
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  // Permission model updates: allow ownership management
  const canEdit = isLeadership || isSelfMode;
  const canDelete = isLeadership || isSelfMode;
  const canCreate = isLeadership || isSelfMode;

  // Query completed PS entries for all users to calculate skill score and ranks
  const { data: allCompletedEntries = [] } = useQuery({
    queryKey: ['all-completed-ps-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ps_daily_entries')
        .select('user_id, skill_name, reward_points')
        .eq('status', 'completed');
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });

  // Map all skills to users: skillName.toLowerCase() -> array of user_ids
  const usersWithThisSkill = useMemo(() => {
    const map = new Map<string, string[]>();
    (allSkills || []).forEach(s => {
      const nameKey = s.skill_name.trim().toLowerCase();
      if (!map.has(nameKey)) {
        map.set(nameKey, []);
      }
      map.get(nameKey)!.push(s.user_id);
    });
    return map;
  }, [allSkills]);

  // Calculate dynamic score and standard competition rank for a skill
  const getSkillPerformance = (sName: string) => {
    const targetSkill = sName.trim().toLowerCase();
    const candidateUserIds = usersWithThisSkill.get(targetSkill) || [];
    
    // Ensure current userId is included in candidates
    const uniqueCandidates = Array.from(new Set([...candidateUserIds, userId]));
    
    // Sum reward points by user for this skill among candidate users
    const userPointsMap: Record<string, number> = {};
    uniqueCandidates.forEach(uid => {
      userPointsMap[uid] = 0;
    });

    allCompletedEntries.forEach(entry => {
      if (entry.skill_name?.trim().toLowerCase() === targetSkill) {
        const entryUserId = entry.user_id;
        if (userPointsMap[entryUserId] !== undefined) {
          userPointsMap[entryUserId] += (entry.reward_points || 0);
        }
      }
    });

    const score = userPointsMap[userId] || 0;
    
    // If no one among candidates has any points for this skill, rank is unavailable
    const hasAnyPoints = Object.values(userPointsMap).some(p => p > 0);
    if (!hasAnyPoints) {
      return { score, rank: 'unavailable' };
    }

    // Standard competition ranking: Rank = 1 + (number of candidates with score > current score)
    let usersAhead = 0;
    Object.keys(userPointsMap).forEach(uid => {
      if (uid !== userId && userPointsMap[uid] > score) {
        usersAhead++;
      }
    });

    const rank = usersAhead + 1;
    return { score, rank };
  };

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftScroll(scrollLeft > 5);
      setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [skills]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const resetForm = () => {
    setEditingSkill(null);
    setSkillName('');
    setSkillType('primary');
    setDomain('General');
    setCustomDomain('');
  };

  const handleOpenAssign = () => {
    resetForm();
    setIsOpen(true);
  };

  const handleOpenEdit = (skill: MemberSkill) => {
    if (!canEdit) return;
    setEditingSkill(skill);
    setSkillName(skill.skill_name);
    setSkillType(skill.skill_type);
    if (skill.custom_domain) {
      setDomain('custom');
      setCustomDomain(skill.custom_domain);
    } else {
      const derived = getEffectiveDomain(skill.skill_name, skill.domain, skill.custom_domain);
      setDomain(derived);
      setCustomDomain('');
    }
    setIsOpen(true);
  };

  const handleSkillNameChange = (name: string) => {
    setSkillName(name);
    if (domain !== 'custom') {
      const normalized = name.trim().toLowerCase();
      if (SKILL_TO_DOMAIN_MAP[normalized]) {
        setDomain(SKILL_TO_DOMAIN_MAP[normalized]);
      }
    }
  };

  const canSelectType = (type: SkillType) => {
    if (editingSkill && editingSkill.skill_type === type) {
      return true;
    }
    const otherSkillsCount = skills.filter(s => s.skill_type === type && s.id !== editingSkill?.id).length;
    return otherSkillsCount < SKILL_TYPE_LIMITS[type].max;
  };

  const handleSave = async () => {
    const trimmedName = skillName.trim();
    if (!trimmedName) return;
    if (domain === 'custom' && !customDomain.trim()) return;

    const isDuplicate = skills.some(
      s => s.id !== editingSkill?.id && s.skill_name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      toast({
        variant: 'destructive',
        title: 'Duplicate Skill',
        description: `Skill "${trimmedName}" is already assigned to this member.`,
      });
      return;
    }

    if (!canSelectType(skillType)) {
      toast({
        variant: 'destructive',
        title: 'Limit Exceeded',
        description: `Cannot set to ${SKILL_TYPE_LABELS[skillType]}. Maximum limit of ${SKILL_TYPE_LIMITS[skillType].max} reached.`,
      });
      return;
    }

    const finalDomain = domain === 'custom' ? 'General' : domain;
    const finalCustomDomain = domain === 'custom' ? customDomain.trim() : null;

    if (editingSkill) {
      await updateSkill.mutateAsync({
        id: editingSkill.id,
        user_id: userId,
        skill_name: trimmedName,
        skill_type: skillType,
        domain: finalDomain as any,
        custom_domain: finalCustomDomain,
      });
    } else {
      await assignSkill.mutateAsync({
        user_id: userId,
        skill_name: trimmedName,
        skill_type: skillType,
        domain: finalDomain as any,
        custom_domain: finalCustomDomain || undefined,
        assigned_by: user?.id,
      });
    }

    resetForm();
    setIsOpen(false);
  };

  const isPending = assignSkill.isPending || updateSkill.isPending;

  return (
    <Card className="krypton-card border border-border/70 p-4 sm:p-5 shadow-xs bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold tracking-tight text-foreground">Skills and indicators</h3>
          <Badge variant="secondary" className="text-xs px-2 py-0.5 font-bold tabular-nums">
            {skills.length}
          </Badge>
        </div>

        {canCreate && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-muted">
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={handleOpenAssign} className="text-xs flex items-center gap-2 font-medium cursor-pointer">
                <Plus className="w-3.5 h-3.5 text-primary" /> Add Skill
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Dialog for Add/Edit */}
        <Dialog open={isOpen} onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="w-[95vw] max-w-md rounded-2xl p-4 sm:p-6 bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                {editingSkill 
                  ? `Edit Skill` 
                  : isSelfMode ? 'Add Your Skill' : `Assign Skill`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Skill Name</Label>
                <Input
                  value={skillName}
                  onChange={e => handleSkillNameChange(e.target.value)}
                  placeholder="e.g., UI Design, DevOps, React"
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Skill Type</Label>
                <Select value={skillType} onValueChange={v => setSkillType(v as SkillType)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['primary', 'secondary', 'specialization'] as SkillType[]).map(type => {
                      const count = skills.filter(s => s.skill_type === type && s.id !== editingSkill?.id).length;
                      const disabled = !canSelectType(type);
                      return (
                        <SelectItem key={type} value={type} disabled={disabled} className="text-xs">
                          {SKILL_TYPE_LABELS[type]} ({count}/{SKILL_TYPE_LIMITS[type].max})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Domain</Label>
                <Select value={domain} onValueChange={v => setDomain(v)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {DOMAIN_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                    ))}
                    <SelectItem value="custom" className="text-xs">✨ Custom Domain</SelectItem>
                  </SelectContent>
                </Select>
                {domain === 'custom' && (
                  <Input
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    placeholder="Enter custom domain name"
                    className="mt-2 text-xs h-9"
                  />
                )}
              </div>

              {/* Limits Information Box */}
              <div className="text-[11px] text-muted-foreground space-y-1 bg-muted/40 rounded-xl p-3 border border-border/40">
                <p className="font-bold text-foreground">Limits per member:</p>
                <p>• Primary: max 2 • Secondary: max 2 • Specialization: max 3</p>
              </div>

              <Button 
                onClick={handleSave} 
                className="w-full text-xs h-9 font-semibold" 
                disabled={!skillName.trim() || !canSelectType(skillType) || isPending || (domain === 'custom' && !customDomain.trim())}
              >
                {isPending 
                  ? (editingSkill ? 'Saving...' : 'Adding...') 
                  : (editingSkill ? 'Save Changes' : isSelfMode ? 'Add Skill' : 'Assign Skill')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Horizontally Scrollable Skill Cards Container */}
      {skills.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-border/80 rounded-xl bg-muted/5 flex flex-col items-center justify-center">
          <GraduationCap className="w-8 h-8 text-muted-foreground/30 mb-2" />
          <p className="text-xs font-semibold text-muted-foreground">No skills assigned yet</p>
          {canCreate && (
            <button
              onClick={handleOpenAssign}
              className="text-xs text-primary font-semibold hover:underline mt-1.5"
            >
              Add your first skill
            </button>
          )}
        </div>
      ) : (
        <div className="relative group/scroll w-full">
          {showLeftScroll && (
            <button
              onClick={() => handleScroll('left')}
              className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 hover:bg-background border border-border/80 flex items-center justify-center shadow-xs hover:scale-105 transition-all opacity-0 group-hover/scroll:opacity-100 duration-200"
              type="button"
            >
              <ChevronLeft className="w-4 h-4 text-foreground" />
            </button>
          )}
          
          <div
            ref={scrollRef}
            className="w-full flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory py-1 px-0.5 scroll-smooth"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {skills.map((skill) => {
              const { score, rank } = getSkillPerformance(skill.skill_name);
              const domainName = skill.custom_domain || skill.domain;
              return (
                <div
                  key={skill.id}
                  className="group relative flex flex-col justify-between p-3.5 w-[175px] h-[145px] shrink-0 rounded-2xl border border-border/70 bg-card hover:border-primary/30 shadow-xs hover:shadow-sm transition-all duration-200 snap-start"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${getSkillTypeColor(skill.skill_type)}`}>
                      {SKILL_TYPE_LABELS[skill.skill_type]}
                    </span>
                    
                    {/* Context menu */}
                    {(canEdit || canDelete) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-5 w-5 rounded-full hover:bg-muted -mt-1 -mr-1">
                            <MoreVertical className="w-3 h-3 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-24">
                          {canEdit && (
                            <DropdownMenuItem onClick={() => handleOpenEdit(skill)} className="text-xs flex items-center gap-1.5 font-medium cursor-pointer">
                              <Pencil className="w-3 h-3 text-primary" /> Edit
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem 
                              onClick={() => removeSkill.mutate(skill.id)} 
                              className="text-xs text-destructive flex items-center gap-1.5 font-medium cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  <div className="space-y-0.5 my-1.5 flex-1 flex flex-col justify-center">
                    <h4 className="text-xs font-bold text-foreground line-clamp-2 tracking-tight group-hover:text-primary transition-colors leading-tight" title={skill.skill_name}>
                      {skill.skill_name}
                    </h4>
                    {domainName && (
                      <p className="text-[9px] text-muted-foreground/80 font-semibold truncate mt-0.5">
                        {domainName}
                      </p>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between pt-1.5 border-t border-border/40 mt-auto">
                    <span className="text-xs font-extrabold text-foreground tabular-nums">
                      {score} <span className="text-[9px] font-bold text-muted-foreground">pts</span>
                    </span>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md tabular-nums">
                      {rank === 'unavailable' ? 'Rank unavailable' : `Rank #${rank}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {showRightScroll && (
            <button
              onClick={() => handleScroll('right')}
              className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 hover:bg-background border border-border/80 flex items-center justify-center shadow-xs hover:scale-105 transition-all opacity-0 group-hover/scroll:opacity-100 duration-200"
              type="button"
            >
              <ChevronRight className="w-4 h-4 text-foreground" />
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

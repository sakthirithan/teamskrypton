import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Search, Filter, Layers, Users, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppMode } from '@/hooks/useAppMode';
import { MemberSkill, SkillType, SKILL_TYPE_LABELS, DOMAIN_OPTIONS, getEffectiveDomain } from '@/hooks/useMemberSkills';
import { VISIBLE_PROFILE_OR } from '@/lib/profileVisibility';

function getSkillTypeColor(type: SkillType): string {
  switch (type) {
    case 'primary': return 'bg-primary/10 text-primary border-primary/20';
    case 'secondary': return 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20';
    case 'specialization': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    default:
    return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

interface ProfileBasic {
  user_id: string;
  full_name: string;
  department: string;
}

export function SkillWiseMemberList() {
  const navigate = useNavigate();
  const { mode } = useAppMode();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterDomain, setFilterDomain] = useState<string>('all');

  const { data: allSkills = [] } = useQuery({
    queryKey: ['all-member-skills'],
    queryFn: async () => {
      const { data, error } = await supabase.from('member_skills').select('*').order('skill_type', { ascending: true })
.order('skill_name', { ascending: true });
      if (error) throw error;
      return data as MemberSkill[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['team-profiles-basic'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, department').or(VISIBLE_PROFILE_OR).eq('is_test', false);
      if (error) throw error;
      return data as ProfileBasic[];
    },
  });

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.user_id, p])), [profiles]);

  const skillGroups = useMemo(() => {
    let filtered = allSkills;
    if (filterType !== 'all') filtered = filtered.filter(s => s.skill_type === filterType);
    if (filterDomain !== 'all') {
      filtered = filtered.filter(s => 
        getEffectiveDomain(s.skill_name, s.domain, s.custom_domain).toLowerCase() === filterDomain.toLowerCase()
      );
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s =>
        s.skill_name.toLowerCase().includes(q) ||
        getEffectiveDomain(s.skill_name, s.domain, s.custom_domain).toLowerCase().includes(q) ||
        profileMap.get(s.user_id)?.full_name.toLowerCase().includes(q)
      );
    }

    const groups = new Map<string, { type: SkillType; domain: string; members: { userId: string; name: string; department: string }[] }>();
    filtered.forEach(skill => {
      const profile = profileMap.get(skill.user_id);
      if (!profile) return;
      const key = `${skill.skill_name}__${skill.skill_type}`;
      const effectiveDomain = getEffectiveDomain(skill.skill_name, skill.domain, skill.custom_domain);
      if (!groups.has(key)) groups.set(key, { type: skill.skill_type, domain: effectiveDomain, members: [] });
      const existing = groups.get(key)!;
      if (!existing.members.some(m => m.userId === skill.user_id)) {
        existing.members.push({ userId: skill.user_id, name: profile.full_name, department: profile.department });
      }
    });

    return Array.from(groups.entries())
      .map(([key, val]) => ({ skillName: key.split('__')[0], ...val }))
      .sort((a, b) => {
        const typeOrder: Record<string, number> = { primary: 0, secondary: 1, specialization: 2 };
        return (typeOrder[a.type] || 0) - (typeOrder[b.type] || 0) || a.skillName.localeCompare(b.skillName);
      });
  }, [allSkills, profiles, filterType, filterDomain, search, profileMap]);

  const handleMemberClick = (userId: string) => {
    if (mode === 'grouping') {
      navigate(`/grouping/me?userId=${userId}`);
    } else {
      navigate(`/profile/${userId}`);
    }
  };

  // Summary stats
  const uniqueSkills = new Set(allSkills.map(s => s.skill_name)).size;
  const uniqueMembers = new Set(allSkills.map(s => s.user_id)).size;

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-primary/10">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Layers className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold">{uniqueSkills}</p>
              <p className="text-[10px] text-muted-foreground">Unique Skills</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-[hsl(var(--success))]/10">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--success))]/10 flex items-center justify-center">
              <Users className="w-4.5 h-4.5 text-[hsl(var(--success))]" />
            </div>
            <div>
              <p className="text-xl font-bold">{uniqueMembers}</p>
              <p className="text-[10px] text-muted-foreground">Skilled Members</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-purple-500/10">
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Filter className="w-4.5 h-4.5 text-purple-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{skillGroups.length}</p>
              <p className="text-[10px] text-muted-foreground">Skill Groups</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-3.5">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search skill or member..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Skill Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="primary">Primary</SelectItem>
                <SelectItem value="secondary">Secondary</SelectItem>
                <SelectItem value="specialization">Specialization</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDomain} onValueChange={setFilterDomain}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <Layers className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Domain" />
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                <SelectItem value="all">All Domains</SelectItem>
                {DOMAIN_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Skill Groups */}
      {skillGroups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-3">
              <Layers className="w-7 h-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground">No skills found matching your filters</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[650px]">
          <div className="space-y-3 pr-1">
            {skillGroups.map((group, idx) => (
              <Card key={idx} className="overflow-hidden hover:shadow-sm transition-all duration-200">
                <CardHeader className="pb-2 pt-3.5 px-4 bg-secondary/20">
                  <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-[10px] ${getSkillTypeColor(group.type)}`}>
                      {SKILL_TYPE_LABELS[group.type]}
                    </Badge>
                    <span className="font-semibold">{group.skillName}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto h-5 gap-0.5">
                      <Users className="w-3 h-3" />
                      {group.members.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-2.5">
                  <ScrollArea className="max-h-[160px] w-full pr-3">
                    <div className="flex flex-wrap gap-2">
                      {group.members.map(m => (
                        <button
                          key={m.userId}
                          onClick={() => handleMemberClick(m.userId)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/40 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all duration-200 text-left group"
                        >
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 ring-1 ring-primary/10">
                            <User className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div>
                            <p className="text-xs font-medium leading-tight group-hover:text-primary transition-colors">{m.name}</p>
                            <p className="text-[10px] text-muted-foreground">{m.department}</p>
                          </div>
                          <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-primary/50 transition-colors ml-1" />
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

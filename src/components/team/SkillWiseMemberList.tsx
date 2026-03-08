import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Search, Filter, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppMode } from '@/hooks/useAppMode';
import { MemberSkill, SkillType, SKILL_TYPE_LABELS, SKILL_DOMAIN_LABELS, SkillDomain } from '@/hooks/useMemberSkills';

function getSkillTypeColor(type: SkillType): string {
  switch (type) {
    case 'primary': return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
    case 'secondary': return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
    case 'specialization': return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20';
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
      const { data, error } = await supabase
        .from('member_skills')
        .select('*')
        .order('skill_type')
        .order('skill_name');
      if (error) throw error;
      return data as MemberSkill[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['team-profiles-basic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, department')
        .eq('is_test', false);
      if (error) throw error;
      return data as ProfileBasic[];
    },
  });

  const profileMap = useMemo(() => new Map(profiles.map(p => [p.user_id, p])), [profiles]);

  // Get unique skill names for grouping
  const skillGroups = useMemo(() => {
    let filtered = allSkills;
    if (filterType !== 'all') filtered = filtered.filter(s => s.skill_type === filterType);
    if (filterDomain !== 'all') filtered = filtered.filter(s => s.domain === filterDomain);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(s => 
        s.skill_name.toLowerCase().includes(q) || 
        profileMap.get(s.user_id)?.full_name.toLowerCase().includes(q)
      );
    }

    const groups = new Map<string, { type: SkillType; domain: SkillDomain; members: { userId: string; name: string; department: string }[] }>();
    filtered.forEach(skill => {
      const profile = profileMap.get(skill.user_id);
      if (!profile) return;
      const key = `${skill.skill_name}__${skill.skill_type}`;
      if (!groups.has(key)) {
        groups.set(key, { type: skill.skill_type, domain: skill.domain, members: [] });
      }
      groups.get(key)!.members.push({
        userId: skill.user_id,
        name: profile.full_name,
        department: profile.department,
      });
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

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search skill or member..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
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
          <SelectContent>
            <SelectItem value="all">All Domains</SelectItem>
            {Object.entries(SKILL_DOMAIN_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Skill Groups */}
      {skillGroups.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No skills found matching your filters.</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="max-h-[650px]">
          <div className="space-y-3 pr-1">
            {skillGroups.map((group, idx) => (
              <Card key={idx} className="border-muted">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={`text-xs ${getSkillTypeColor(group.type)}`}>
                      {SKILL_TYPE_LABELS[group.type]}
                    </Badge>
                    <span className="font-semibold">{group.skillName}</span>
                    <Badge variant="secondary" className="text-[10px] ml-auto">
                      {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="flex flex-wrap gap-2">
                    {group.members.map(m => (
                      <button
                        key={m.userId}
                        onClick={() => handleMemberClick(m.userId)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 border border-transparent hover:border-primary/20 transition-colors text-left"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-3 h-3 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-medium leading-tight">{m.name}</p>
                          <p className="text-[10px] text-muted-foreground">{m.department}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

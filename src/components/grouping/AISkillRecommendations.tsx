import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Lightbulb, RefreshCw, Zap, BookOpen, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMemberSkills } from '@/hooks/useMemberSkills';
import { useSkillTracks } from '@/hooks/useSkillTracks';
import { useToast } from '@/hooks/use-toast';

interface SkillSuggestion {
  skill_name: string;
  reason: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
}

interface AISkillRecommendationsProps {
  userId: string;
  sessionId?: string;
}

const difficultyConfig: Record<string, { icon: typeof Zap; color: string; bgColor: string }> = {
  beginner: {
    icon: BookOpen,
    color: 'text-[hsl(var(--success))]',
    bgColor: 'bg-[hsl(var(--success))]/10 border-[hsl(var(--success))]/20',
  },
  intermediate: {
    icon: TrendingUp,
    color: 'text-[hsl(var(--warning))]',
    bgColor: 'bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/20',
  },
  advanced: {
    icon: Zap,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10 border-destructive/20',
  },
};

export function AISkillRecommendations({ userId, sessionId }: AISkillRecommendationsProps) {
  const { skills } = useMemberSkills(userId);
  const { tracks } = useSkillTracks(sessionId, userId);
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    const currentSkills = [...skills.map(s => s.skill_name), ...tracks.map(t => t.skill_name)];
    if (currentSkills.length === 0) {
      toast({ variant: 'destructive', title: 'No skills found', description: 'Add some skills first to get recommendations.' });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-skills', {
        body: { current_skills: [...new Set(currentSkills)], skill_type: skills[0]?.skill_type || 'general', domain: skills[0]?.domain || 'general' },
      });
      if (error) throw error;
      setSuggestions(data?.suggestions || []);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to get recommendations', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 via-transparent to-purple-500/5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              AI Skill Recommendations
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Personalized learning suggestions based on your skill portfolio
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant={suggestions.length > 0 ? 'outline' : 'default'}
            onClick={handleGenerate}
            disabled={isLoading}
            className="h-8 text-xs gap-1.5"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : suggestions.length > 0 ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isLoading ? 'Analyzing...' : suggestions.length > 0 ? 'Refresh' : 'Get Suggestions'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {suggestions.length === 0 && !isLoading ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center mx-auto mb-3">
              <Lightbulb className="w-6 h-6 text-primary/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              Get AI-powered skill recommendations
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Based on your current skills and learning tracks
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Analyzing your skill profile...</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {suggestions.map((s, i) => {
              const config = difficultyConfig[s.difficulty] || difficultyConfig.beginner;
              const DiffIcon = config.icon;
              return (
                <div key={i} className="p-3.5 rounded-xl border hover:border-primary/20 hover:shadow-sm transition-all duration-200 group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className={`w-7 h-7 rounded-lg ${config.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                        <DiffIcon className={`w-3.5 h-3.5 ${config.color}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold group-hover:text-primary transition-colors">{s.skill_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.reason}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${config.bgColor}`}>
                        {s.difficulty}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {s.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

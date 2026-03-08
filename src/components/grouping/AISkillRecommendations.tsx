import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Loader2, Lightbulb, RefreshCw } from 'lucide-react';
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

export function AISkillRecommendations({ userId, sessionId }: AISkillRecommendationsProps) {
  const { skills } = useMemberSkills(userId);
  const { tracks } = useSkillTracks(sessionId, userId);
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<SkillSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    const currentSkills = [
      ...skills.map(s => s.skill_name),
      ...tracks.map(t => t.skill_name),
    ];

    if (currentSkills.length === 0) {
      toast({ variant: 'destructive', title: 'No skills found', description: 'Add some skills first to get recommendations.' });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('suggest-skills', {
        body: {
          current_skills: [...new Set(currentSkills)],
          skill_type: skills[0]?.skill_type || 'general',
          domain: skills[0]?.domain || 'general',
        },
      });

      if (error) throw error;
      setSuggestions(data?.suggestions || []);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Failed to get recommendations', description: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  const difficultyColors: Record<string, string> = {
    beginner: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    intermediate: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
    advanced: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Skill Recommendations
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            ) : suggestions.length > 0 ? (
              <RefreshCw className="w-3 h-3 mr-1" />
            ) : (
              <Sparkles className="w-3 h-3 mr-1" />
            )}
            {isLoading ? 'Analyzing...' : suggestions.length > 0 ? 'Refresh' : 'Get Suggestions'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 && !isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            Click "Get Suggestions" to get AI-powered skill recommendations based on your current portfolio.
          </p>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="p-3 rounded-lg border bg-card/50 hover:bg-accent/5 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm font-medium">{s.skill_name}</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${difficultyColors[s.difficulty] || ''}`}>
                      {s.difficulty}
                    </Badge>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                      {s.category}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground ml-5">{s.reason}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

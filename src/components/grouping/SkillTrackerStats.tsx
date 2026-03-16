import { useMemo } from 'react';
import { SkillTrack, useSkillTracks } from '@/hooks/useSkillTracks';
import { BookOpen, CheckCircle, Loader2, Target } from 'lucide-react';

interface SkillTrackerStatsProps {
  tracks: SkillTrack[];
  sessionId: string;
  userId: string;
}

export function SkillTrackerStats({ tracks, sessionId, userId }: SkillTrackerStatsProps) {
  const { useFlowchartBlocks } = useSkillTracks(sessionId, userId);
  
  // We can't call hooks in a loop, so we show aggregate track-level stats
  const primaryCount = tracks.filter(t => t.is_primary).length;
  const uniqueSkills = new Set(tracks.map(t => t.skill_name)).size;

  return (
    <div className="grid grid-cols-3 gap-1.5 animate-in fade-in-0 duration-300">
      <div className="rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-2 text-center">
        <p className="text-base font-bold text-primary leading-none">{uniqueSkills}</p>
        <p className="text-[9px] text-muted-foreground mt-0.5">Unique Skills</p>
      </div>
      <div className="rounded-lg bg-[hsl(var(--warning))]/5 border border-[hsl(var(--warning))]/10 px-2.5 py-2 text-center">
        <p className="text-base font-bold text-[hsl(var(--warning))] leading-none">{primaryCount}</p>
        <p className="text-[9px] text-muted-foreground mt-0.5">Primary Focus</p>
      </div>
      <div className="rounded-lg bg-muted/50 border border-border/50 px-2.5 py-2 text-center">
        <p className="text-base font-bold text-foreground leading-none">{tracks.length}</p>
        <p className="text-[9px] text-muted-foreground mt-0.5">Total Tracks</p>
      </div>
    </div>
  );
}

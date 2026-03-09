import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Star, BookOpen, Trash2, ChevronDown, ChevronRight, BarChart3, Calendar, Lock, Unlock } from 'lucide-react';
import { useSkillTracks, SkillTrack } from '@/hooks/useSkillTracks';
import { useSkillStreaks } from '@/hooks/useSkillStreaks';
import { LearningFlowchart } from '@/components/grouping/LearningFlowchart';
import { SkillProgressAnalytics } from '@/components/grouping/SkillProgressAnalytics';
import { SkillHistoryExport } from '@/components/grouping/SkillHistoryExport';
import { AISkillRecommendations } from '@/components/grouping/AISkillRecommendations';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfWeek } from 'date-fns';

interface SkillTrackerProps {
  session: GroupingSession;
  userId: string;
  isReadOnly?: boolean;
}

export function SkillTracker({ session, userId, isReadOnly = false }: SkillTrackerProps) {
  const { isLeadership } = useAuth();
  const { tracks, suggestions, createTrack, deleteTrack, updateTrack } = useSkillTracks(session.id, userId);
  const { streak, recordWeekActivity } = useSkillStreaks(session.id, userId);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [customSkill, setCustomSkill] = useState('');
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);

  const tracksByWeek = useMemo(() => {
    const grouped: Record<string, SkillTrack[]> = {};
    tracks.forEach(t => {
      const week = t.week_start;
      if (!grouped[week]) grouped[week] = [];
      grouped[week].push(t);
    });
    return grouped;
  }, [tracks]);

  const weekKeys = Object.keys(tracksByWeek).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const handleAdd = async () => {
    const name = skillName || customSkill;
    if (!name.trim()) return;
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    await createTrack.mutateAsync({ skill_name: name.trim(), is_primary: isPrimary, week_start: weekStart });
    setSkillName('');
    setCustomSkill('');
    setIsPrimary(false);
    setIsAddOpen(false);
  };

  const handleSetPrimary = async (track: SkillTrack) => {
    const sameWeekTracks = tracks.filter(t => t.week_start === track.week_start && t.id !== track.id && t.is_primary);
    for (const t of sameWeekTracks) {
      await updateTrack.mutateAsync({ id: t.id, is_primary: false });
    }
    await updateTrack.mutateAsync({ id: track.id, is_primary: !track.is_primary });
  };

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 via-transparent to-[hsl(var(--info))]/5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--info))] flex items-center justify-center">
                <BookOpen className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Skill Development Tracker
                  {isLeadership && streak && streak.current_streak > 0 && (
                    <Badge variant="outline" className="text-[10px] bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 gap-0.5">
                      🔥 {streak.current_streak}w streak
                    </Badge>
                  )}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tracks.length} skill{tracks.length !== 1 ? 's' : ''} tracked across {weekKeys.length} week{weekKeys.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLeadership && (
                <Button size="sm" variant="outline" onClick={() => setShowAnalytics(!showAnalytics)} className="h-8 text-xs gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" />
                  {showAnalytics ? 'Hide' : 'Analytics'}
                </Button>
              )}
              {isLeadership && (
                <SkillHistoryExport sessionId={session.id} userId={userId} userName={userId} />
              )}
              {!isReadOnly && (
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-8 text-xs gap-1.5">
                      <Plus className="w-3.5 h-3.5" />
                      Add Skill
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Skill Track</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      {suggestions.length > 0 && (
                        <div className="space-y-2">
                          <Label>Suggested Skills</Label>
                          <div className="flex flex-wrap gap-2">
                            {suggestions.map(s => (
                              <Badge
                                key={s.id}
                                variant={skillName === s.name ? 'default' : 'outline'}
                                className="cursor-pointer hover:bg-primary/10 transition-colors"
                                onClick={() => { setSkillName(s.name); setCustomSkill(''); }}
                              >
                                {s.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>Or enter custom skill</Label>
                        <Input
                          value={customSkill}
                          onChange={e => { setCustomSkill(e.target.value); setSkillName(''); }}
                          placeholder="e.g., React, Machine Learning, Docker"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="isPrimary" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="rounded" />
                        <Label htmlFor="isPrimary" className="cursor-pointer">
                          <Star className="w-3 h-3 inline mr-1 text-[hsl(var(--warning))]" />
                          Mark as primary focus this week
                        </Label>
                      </div>
                      <Button onClick={handleAdd} className="w-full" disabled={(!skillName && !customSkill.trim()) || createTrack.isPending}>
                        {createTrack.isPending ? 'Adding...' : 'Add Skill Track'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Analytics Panel */}
      {showAnalytics && <SkillProgressAnalytics session={session} userId={userId} />}

      {/* Empty state */}
      {tracks.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-[hsl(var(--info))]/10 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-7 h-7 text-primary/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No skill tracks yet</p>
            {!isReadOnly && (
              <p className="text-xs text-muted-foreground/70 mt-1">Add your first skill to start tracking your learning journey</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tracks grouped by week */}
      {weekKeys.map(week => (
        <Card key={week} className="overflow-hidden">
          <CardHeader className="pb-2 bg-secondary/30">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Week of {format(new Date(week), 'MMM dd, yyyy')}
              <Badge variant="secondary" className="text-[10px] ml-auto h-4">
                {tracksByWeek[week].length} skill{tracksByWeek[week].length !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 space-y-2">
            {tracksByWeek[week].map(track => (
              <div key={track.id} className="rounded-xl border hover:border-primary/20 transition-all duration-200 overflow-hidden">
                <div
                  className="flex items-center gap-3 p-3.5 cursor-pointer hover:bg-secondary/30 transition-colors"
                  onClick={() => setExpandedTrack(expandedTrack === track.id ? null : track.id)}
                >
                  {expandedTrack === track.id ? (
                    <ChevronDown className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium text-sm flex-1">{track.skill_name}</span>
                  {track.is_primary && (
                    <Badge variant="default" className="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 gap-0.5 text-[10px]">
                      <Star className="w-3 h-3 fill-[hsl(var(--warning))]" />
                      Primary
                    </Badge>
                  )}
                  {!isReadOnly && (
                    <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={`h-7 w-7 ${track.is_sequential ? 'text-primary' : 'text-muted-foreground/40'}`}
                              onClick={() => updateTrack.mutate({ id: track.id, is_sequential: !track.is_sequential })}
                              title={track.is_sequential ? 'Sequential mode ON' : 'Sequential mode OFF'}
                            >
                              {track.is_sequential ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{track.is_sequential ? 'Sequential: Must complete steps in order' : 'Click to enforce step order'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 hover:bg-[hsl(var(--warning))]/10"
                        onClick={() => handleSetPrimary(track)}
                        title={track.is_primary ? 'Remove primary' : 'Set as primary'}
                      >
                        <Star className={`w-3.5 h-3.5 ${track.is_primary ? 'fill-[hsl(var(--warning))] text-[hsl(var(--warning))]' : 'text-muted-foreground'}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => deleteTrack.mutate(track.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {expandedTrack === track.id && (
                  <div className="border-t bg-secondary/10 px-3.5 pb-3.5 pt-3">
                    <LearningFlowchart
                      trackId={track.id}
                      sessionId={session.id}
                      userId={userId}
                      isReadOnly={isReadOnly}
                      onFlowchartUpdate={() => recordWeekActivity.mutate()}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* AI Skill Recommendations */}
      {!isReadOnly && <AISkillRecommendations userId={userId} sessionId={session.id} />}
    </div>
  );
}

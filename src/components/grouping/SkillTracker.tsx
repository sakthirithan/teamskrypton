import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Star, BookOpen, Trash2, ChevronDown, ChevronRight, BarChart3 } from 'lucide-react';
import { useSkillTracks, SkillTrack } from '@/hooks/useSkillTracks';
import { useSkillStreaks } from '@/hooks/useSkillStreaks';
import { LearningFlowchart } from '@/components/grouping/LearningFlowchart';
import { SkillProgressAnalytics } from '@/components/grouping/SkillProgressAnalytics';
import { SkillHistoryExport } from '@/components/grouping/SkillHistoryExport';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { format, startOfWeek } from 'date-fns';

interface SkillTrackerProps {
  session: GroupingSession;
  userId: string;
  isReadOnly?: boolean;
}

export function SkillTracker({ session, userId, isReadOnly = false }: SkillTrackerProps) {
  const { tracks, suggestions, createTrack, deleteTrack, updateTrack } = useSkillTracks(session.id, userId);
  const { streak, recordActivity } = useSkillStreaks(session.id, userId);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [customSkill, setCustomSkill] = useState('');
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);

  // Record streak activity when user interacts
  useEffect(() => {
    if (tracks.length > 0 && !isReadOnly) {
      recordActivity.mutate();
    }
  }, [tracks.length]); // eslint-disable-line

  // Group tracks by week
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
    // Unset other primaries for same week
    const sameWeekTracks = tracks.filter(t => t.week_start === track.week_start && t.id !== track.id && t.is_primary);
    for (const t of sameWeekTracks) {
      await updateTrack.mutateAsync({ id: t.id, is_primary: false });
    }
    await updateTrack.mutateAsync({ id: track.id, is_primary: !track.is_primary });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Skill Development Tracker
          {streak && streak.current_streak > 0 && (
            <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
              🔥 {streak.current_streak}d streak
            </Badge>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowAnalytics(!showAnalytics)}>
            <BarChart3 className="w-4 h-4 mr-1" />
            {showAnalytics ? 'Hide' : 'Analytics'}
          </Button>
          <SkillHistoryExport sessionId={session.id} userId={userId} userName={userId} />
          {!isReadOnly && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
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
                            className="cursor-pointer"
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
                      <Star className="w-3 h-3 inline mr-1 text-amber-500" />
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

      {/* Analytics Panel */}
      {showAnalytics && (
        <SkillProgressAnalytics session={session} userId={userId} />
      )}

      {/* Empty state */}
      {tracks.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">No skill tracks yet.</p>
            {!isReadOnly && (
              <p className="text-sm text-muted-foreground mt-1">Add your first skill to start tracking your learning journey.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tracks grouped by week */}
      {weekKeys.map(week => (
        <Card key={week}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Week of {format(new Date(week), 'MMM dd, yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tracksByWeek[week].map(track => (
              <div key={track.id} className="border rounded-lg">
                {/* Track header */}
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedTrack(expandedTrack === track.id ? null : track.id)}
                >
                  {expandedTrack === track.id ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-medium flex-1">{track.skill_name}</span>
                  {track.is_primary && (
                    <Badge variant="default" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                      <Star className="w-3 h-3 mr-1 fill-amber-500" />
                      Primary
                    </Badge>
                  )}
                  {!isReadOnly && (
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleSetPrimary(track)}
                        title={track.is_primary ? 'Remove primary' : 'Set as primary'}
                      >
                        <Star className={`w-3 h-3 ${track.is_primary ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteTrack.mutate(track.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Expanded: Flowchart */}
                {expandedTrack === track.id && (
                  <div className="border-t px-3 pb-3 pt-2">
                    <LearningFlowchart
                      trackId={track.id}
                      sessionId={session.id}
                      userId={userId}
                      isReadOnly={isReadOnly}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

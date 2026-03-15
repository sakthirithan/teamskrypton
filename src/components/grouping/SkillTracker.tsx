import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Star, BookOpen, Trash2, ChevronDown, ChevronRight, BarChart3, Calendar, Lock, Unlock } from 'lucide-react';
import { useSkillTracks, SkillTrack } from '@/hooks/useSkillTracks';
import { useSkillStreaks } from '@/hooks/useSkillStreaks';
import { LearningFlowchart } from '@/components/grouping/LearningFlowchart';
import { SkillProgressAnalytics } from '@/components/grouping/SkillProgressAnalytics';
import { SkillHistoryExport } from '@/components/grouping/SkillHistoryExport';
import { DailyStudyBoard } from '@/components/grouping/DailyStudyBoard';
import { GroupingSession } from '@/hooks/useGroupingSessions';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfWeek } from 'date-fns';

interface SkillTrackerProps {
  session: GroupingSession;
  userId: string;
  isReadOnly?: boolean;
}

export function SkillTracker({ session, userId, isReadOnly = false }: SkillTrackerProps) {
  const { isLeadership, user } = useAuth();
  const { tracks, suggestions, createTrack, deleteTrack, updateTrack } = useSkillTracks(session.id, userId);
  const { streak, recordWeekActivity } = useSkillStreaks(session.id, userId);
  
  const canEdit = !isReadOnly && (isLeadership || userId === user?.id);

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
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight">Skill Development</h3>
            <p className="text-[11px] text-muted-foreground">
              {tracks.length} skill{tracks.length !== 1 ? 's' : ''} · {weekKeys.length} week{weekKeys.length !== 1 ? 's' : ''}
              {isLeadership && streak && streak.current_streak > 0 && (
                <span className="ml-1.5 text-[hsl(var(--warning))]">🔥 {streak.current_streak}w</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isLeadership && (
            <>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={() => setShowAnalytics(!showAnalytics)} 
                className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{showAnalytics ? 'Hide' : 'Analytics'}</span>
              </Button>
              <SkillHistoryExport sessionId={session.id} userId={userId} userName={userId} />
            </>
          )}
          {canEdit && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 text-xs gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Add Skill
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-base">Add Skill Track</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {suggestions.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Suggested</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {suggestions.map(s => (
                          <button
                            key={s.id}
                            className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                              skillName === s.name 
                                ? 'bg-primary text-primary-foreground border-primary' 
                                : 'bg-card border-border hover:border-primary/40 hover:bg-primary/5'
                            }`}
                            onClick={() => { setSkillName(s.name); setCustomSkill(''); }}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Custom Skill</Label>
                    <Input
                      value={customSkill}
                      onChange={e => { setCustomSkill(e.target.value); setSkillName(''); }}
                      placeholder="e.g., React, Machine Learning"
                      className="h-9 text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={isPrimary} 
                      onChange={e => setIsPrimary(e.target.checked)} 
                      className="w-4 h-4 rounded border-2 border-input accent-primary" 
                    />
                    <span className="text-sm flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-[hsl(var(--warning))]" />
                      Primary focus this week
                    </span>
                  </label>
                  <Button 
                    onClick={handleAdd} 
                    className="w-full h-9 text-sm" 
                    disabled={(!skillName && !customSkill.trim()) || createTrack.isPending}
                  >
                    {createTrack.isPending ? 'Adding...' : 'Add Skill'}
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

      {/* Empty State */}
      {tracks.length === 0 && (
        <div className="border border-dashed border-border/60 rounded-lg py-12 text-center">
          <BookOpen className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No skill tracks yet</p>
          {canEdit && (
            <p className="text-xs text-muted-foreground/60 mt-1">Add your first skill to begin tracking</p>
          )}
        </div>
      )}

      {/* Week Groups */}
      {weekKeys.map(week => (
        <div key={week} className="space-y-2">
          {/* Week Header */}
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span className="font-medium">Week of {format(new Date(week), 'MMM dd, yyyy')}</span>
            </div>
            <span className="text-[11px] text-muted-foreground/60">
              {tracksByWeek[week].length} skill{tracksByWeek[week].length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Skill Cards */}
          {tracksByWeek[week].map(track => (
            <Card key={track.id} className="overflow-hidden border-border/50">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedTrack(expandedTrack === track.id ? null : track.id)}
              >
                <div className="shrink-0 text-muted-foreground/60">
                  {expandedTrack === track.id ? (
                    <ChevronDown className="w-4 h-4 text-primary" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
                <span className="text-sm font-medium flex-1 truncate">{track.skill_name}</span>
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  {track.is_primary && (
                    <span className="text-[10px] font-medium bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] px-2 py-0.5 rounded-md flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      Primary
                    </span>
                  )}
                  {canEdit && (
                    <div className="flex items-center gap-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={`h-7 w-7 ${track.is_sequential ? 'text-primary' : 'text-muted-foreground/40'}`}
                            onClick={() => updateTrack.mutate({ id: track.id, is_sequential: !track.is_sequential })}
                          >
                            {track.is_sequential ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">{track.is_sequential ? 'Sequential mode' : 'Enable step order'}</p>
                        </TooltipContent>
                      </Tooltip>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleSetPrimary(track)}
                      >
                        <Star className={`w-3.5 h-3.5 ${track.is_primary ? 'fill-[hsl(var(--warning))] text-[hsl(var(--warning))]' : 'text-muted-foreground/40'}`} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive/50 hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Skill Track</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete "{track.skill_name}" and all its steps, links, and reflections?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => deleteTrack.mutate(track.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>

              {expandedTrack === track.id && (
                <div className="border-t border-border/40 bg-muted/20 px-4 py-4">
                  <LearningFlowchart
                    trackId={track.id}
                    sessionId={session.id}
                    userId={userId}
                    isReadOnly={!canEdit}
                    isSequential={track.is_sequential}
                    onFlowchartUpdate={() => recordWeekActivity.mutate()}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      ))}

      {/* Daily Study Board */}
      {canEdit && (
        <DailyStudyBoard sessionId={session.id} userId={userId} />
      )}
    </div>
  );
}

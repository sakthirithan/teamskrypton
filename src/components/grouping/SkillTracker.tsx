import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Star, BookOpen, Trash2, ChevronDown, ChevronRight, BarChart3, Calendar, Lock, Unlock, Copy, GripVertical } from 'lucide-react';
import { useSkillTracks, SkillTrack } from '@/hooks/useSkillTracks';
import { useSkillStreaks } from '@/hooks/useSkillStreaks';
import { LearningFlowchart } from '@/components/grouping/LearningFlowchart';
import { SkillProgressAnalytics } from '@/components/grouping/SkillProgressAnalytics';
import { SkillHistoryExport } from '@/components/grouping/SkillHistoryExport';
import { DailyStudyBoard } from '@/components/grouping/DailyStudyBoard';
import { SkillTrackerStats } from '@/components/grouping/SkillTrackerStats';
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
    setSkillName(''); setCustomSkill(''); setIsPrimary(false); setIsAddOpen(false);
  };

  const handleDuplicate = async (track: SkillTrack) => {
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    await createTrack.mutateAsync({ skill_name: track.skill_name, is_primary: track.is_primary, week_start: weekStart });
  };

  const handleSetPrimary = async (track: SkillTrack) => {
    const sameWeekTracks = tracks.filter(t => t.week_start === track.week_start && t.id !== track.id && t.is_primary);
    for (const t of sameWeekTracks) {
      await updateTrack.mutateAsync({ id: t.id, is_primary: false });
    }
    await updateTrack.mutateAsync({ id: track.id, is_primary: !track.is_primary });
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold leading-tight">Skill Development</h3>
              <p className="text-[10px] text-muted-foreground">
                {tracks.length} skill{tracks.length !== 1 ? 's' : ''} · {weekKeys.length} week{weekKeys.length !== 1 ? 's' : ''}
                {isLeadership && streak && streak.current_streak > 0 && (
                  <span className="ml-1 text-[hsl(var(--warning))]">🔥 {streak.current_streak}w</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {isLeadership && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setShowAnalytics(!showAnalytics)} className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground px-2">
                  <BarChart3 className="w-3 h-3" />
                  <span className="hidden sm:inline">{showAnalytics ? 'Hide' : 'Stats'}</span>
                </Button>
                <SkillHistoryExport sessionId={session.id} userId={userId} userName={userId} />
              </>
            )}
            {canEdit && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-7 text-[11px] gap-1 px-2">
                    <Plus className="w-3 h-3" /> Add Skill
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-base">Add Skill Track</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    {suggestions.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Suggested</Label>
                        <div className="flex flex-wrap gap-1">
                          {suggestions.map(s => (
                            <button
                              key={s.id}
                              className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
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
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Custom Skill</Label>
                      <Input value={customSkill} onChange={e => { setCustomSkill(e.target.value); setSkillName(''); }} placeholder="e.g., React, Machine Learning" className="h-8 text-xs" />
                    </div>
                    <label className="flex items-center gap-2 p-2 rounded-lg border border-border/60 cursor-pointer hover:bg-muted/30 transition-colors">
                      <input type="checkbox" checked={isPrimary} onChange={e => setIsPrimary(e.target.checked)} className="w-3.5 h-3.5 rounded border-2 border-input accent-primary" />
                      <span className="text-xs flex items-center gap-1">
                        <Star className="w-3 h-3 text-[hsl(var(--warning))]" /> Primary focus
                      </span>
                    </label>
                    <Button onClick={handleAdd} className="w-full h-8 text-xs" disabled={(!skillName && !customSkill.trim()) || createTrack.isPending}>
                      {createTrack.isPending ? 'Adding...' : 'Add Skill'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        {tracks.length > 0 && <SkillTrackerStats tracks={tracks} sessionId={session.id} userId={userId} />}

        {/* Analytics */}
        {showAnalytics && <SkillProgressAnalytics session={session} userId={userId} />}

        {/* Empty State */}
        {tracks.length === 0 && (
          <div className="border border-dashed border-border/60 rounded-lg py-10 text-center animate-in fade-in-0 duration-300">
            <BookOpen className="w-7 h-7 text-muted-foreground/25 mx-auto mb-2" />
            <p className="text-xs font-medium text-muted-foreground">No skill tracks yet</p>
            {canEdit && <p className="text-[10px] text-muted-foreground/60 mt-0.5">Add your first skill to begin tracking</p>}
          </div>
        )}

        {/* Week Groups */}
        {weekKeys.map(week => (
          <div key={week} className="space-y-1.5 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span className="font-medium">Week of {format(new Date(week), 'MMM dd, yyyy')}</span>
              </div>
              <span className="text-[10px] text-muted-foreground/60">{tracksByWeek[week].length} skill{tracksByWeek[week].length !== 1 ? 's' : ''}</span>
            </div>

            {tracksByWeek[week].map(track => (
              <Card key={track.id} className="overflow-hidden border-border/50 transition-all duration-200">
                <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedTrack(expandedTrack === track.id ? null : track.id)}>
                  <div className="shrink-0 text-muted-foreground/60">
                    {expandedTrack === track.id ? <ChevronDown className="w-3.5 h-3.5 text-primary" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-xs font-medium flex-1 truncate">{track.skill_name}</span>
                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                    {track.is_primary && (
                      <span className="text-[9px] font-medium bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Star className="w-2.5 h-2.5 fill-current" /> Primary
                      </span>
                    )}
                    {canEdit && (
                      <div className="flex items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className={`h-6 w-6 ${track.is_sequential ? 'text-primary' : 'text-muted-foreground/40'}`} onClick={() => updateTrack.mutate({ id: track.id, is_sequential: !track.is_sequential })}>
                              {track.is_sequential ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom"><p className="text-xs">{track.is_sequential ? 'Sequential mode' : 'Enable step order'}</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground/40 hover:text-primary" onClick={() => handleDuplicate(track)}>
                              <Copy className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom"><p className="text-xs">Duplicate to this week</p></TooltipContent>
                        </Tooltip>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSetPrimary(track)}>
                          <Star className={`w-3 h-3 ${track.is_primary ? 'fill-[hsl(var(--warning))] text-[hsl(var(--warning))]' : 'text-muted-foreground/40'}`} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive/50 hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Skill Track</AlertDialogTitle>
                              <AlertDialogDescription>Delete "{track.skill_name}" and all its steps, links, and reflections?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteTrack.mutate(track.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>

                {expandedTrack === track.id && (
                  <div className="border-t border-border/40 bg-muted/20 px-3 py-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                    <LearningFlowchart trackId={track.id} sessionId={session.id} userId={userId} isReadOnly={!canEdit} isSequential={track.is_sequential} onFlowchartUpdate={() => recordWeekActivity.mutate()} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        ))}

        {/* Daily Study Board */}
        {canEdit && <DailyStudyBoard sessionId={session.id} userId={userId} />}
      </div>
    </TooltipProvider>
  );
}

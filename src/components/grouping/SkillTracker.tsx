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
import { GlobalScrollLayout } from '@/components/layout/GlobalScrollLayout';

interface SkillTrackerProps {
  session: GroupingSession;
  userId: string;
  isReadOnly?: boolean;
}

export function SkillTracker({ session, userId, isReadOnly = false }: SkillTrackerProps) {
  const { isLeadership, user } = useAuth();
  const { tracks, suggestions, createTrack, deleteTrack, updateTrack } = useSkillTracks(session.id, userId);
  const { streak, recordWeekActivity } = useSkillStreaks(session.id, userId);
  
  // Leadership can always perform CRUD operations on any user's skill tracks
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
    <div className="space-y-3">
        {/* Enhanced Header Card */}
        <Card className="overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-card/80">
          <CardHeader className="pb-4 bg-gradient-to-r from-primary/8 via-primary/5 to-[hsl(var(--info))]/8 border-b border-border/40">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-[hsl(var(--info))] flex items-center justify-center shadow-lg">
                  <BookOpen className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-xl flex items-center gap-3">
                    Skill Development Tracker
                    {isLeadership && streak && streak.current_streak > 0 && (
                      <Badge variant="outline" className="text-xs bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20 gap-1">
                        🔥 {streak.current_streak}w streak
                      </Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tracks.length} skill{tracks.length !== 1 ? 's' : ''} tracked across {weekKeys.length} week{weekKeys.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isLeadership && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setShowAnalytics(!showAnalytics)} 
                    className="h-9 text-sm gap-2 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <BarChart3 className="w-4 h-4" />
                    {showAnalytics ? 'Hide Analytics' : 'View Analytics'}
                  </Button>
                )}
                {isLeadership && (
                  <SkillHistoryExport sessionId={session.id} userId={userId} userName={userId} />
                )}
                {canEdit && (
                  <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="h-9 text-sm gap-2 shadow-sm hover:shadow-md transition-shadow">
                        <Plus className="w-4 h-4" />
                        Add Skill
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Skill Track</DialogTitle>
                      </DialogHeader>
                      <GlobalScrollLayout maxHeight="70vh">
                        <div className="space-y-5 pt-4">
                          {suggestions.length > 0 && (
                            <div className="space-y-3">
                              <Label className="text-base font-medium">Suggested Skills</Label>
                              <div className="flex flex-wrap gap-2">
                                {suggestions.map(s => (
                                  <Badge
                                    key={s.id}
                                    variant={skillName === s.name ? 'default' : 'outline'}
                                    className="cursor-pointer hover:bg-primary/10 transition-all text-sm py-2 px-3"
                                    onClick={() => { setSkillName(s.name); setCustomSkill(''); }}
                                  >
                                    {s.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="space-y-3">
                            <Label className="text-base font-medium">Or enter custom skill</Label>
                            <Input
                              value={customSkill}
                              onChange={e => { setCustomSkill(e.target.value); setSkillName(''); }}
                              placeholder="e.g., React, Machine Learning, Docker"
                              className="text-sm"
                            />
                          </div>
                          <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
                            <input 
                              type="checkbox" 
                              id="isPrimary" 
                              checked={isPrimary} 
                              onChange={e => setIsPrimary(e.target.checked)} 
                              className="w-4 h-4 rounded border-2 border-primary" 
                            />
                            <Label htmlFor="isPrimary" className="cursor-pointer flex items-center gap-2 text-sm">
                              <Star className="w-4 h-4 text-[hsl(var(--warning))]" />
                              Mark as primary focus this week
                            </Label>
                          </div>
                          <Button 
                            onClick={handleAdd} 
                            className="w-full h-10" 
                            disabled={(!skillName && !customSkill.trim()) || createTrack.isPending}
                          >
                            {createTrack.isPending ? 'Adding...' : 'Add Skill Track'}
                          </Button>
                        </div>
                      </GlobalScrollLayout>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Analytics Panel */}
        {showAnalytics && (
          <div className="animate-in slide-in-from-top-2 duration-200">
            <SkillProgressAnalytics session={session} userId={userId} />
          </div>
        )}

        {/* Enhanced Empty State */}
        {tracks.length === 0 && (
          <Card className="border-2 border-dashed border-border/50">
            <CardContent className="py-16 text-center">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-[hsl(var(--info))]/10 flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-10 h-10 text-primary/40" />
              </div>
              <p className="text-lg font-medium text-muted-foreground mb-2">No skill tracks yet</p>
              {canEdit && (
                <p className="text-sm text-muted-foreground/70">Add your first skill to start tracking your learning journey</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Enhanced Tracks Grouped by Week */}
        {weekKeys.map(week => (
          <Card key={week} className="overflow-hidden shadow-sm border-0 bg-gradient-to-br from-card to-card/60">
            <CardHeader className="pb-3 bg-gradient-to-r from-secondary/50 to-secondary/30 border-b border-border/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Week of {format(new Date(week), 'MMM dd, yyyy')}
                </CardTitle>
                <Badge variant="secondary" className="text-xs h-6">
                  {tracksByWeek[week].length} skill{tracksByWeek[week].length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {tracksByWeek[week].map(track => (
                <div key={track.id} className="rounded-2xl border-2 hover:border-primary/30 transition-all duration-300 overflow-hidden bg-card/50 backdrop-blur-sm">
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
                    onClick={() => setExpandedTrack(expandedTrack === track.id ? null : track.id)}
                  >
                    <div className="flex-shrink-0">
                      {expandedTrack === track.id ? (
                        <ChevronDown className="w-5 h-5 text-primary" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="font-semibold text-base flex-1">{track.skill_name}</span>
                    <div className="flex items-center gap-3">
                      {track.is_primary && (
                        <Badge variant="default" className="bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30 gap-1 text-xs py-1">
                          <Star className="w-3.5 h-3.5 fill-[hsl(var(--warning))]" />
                          Primary
                        </Badge>
                      )}
                      {canEdit && (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className={`h-8 w-8 ${track.is_sequential ? 'text-primary' : 'text-muted-foreground/40'}`}
                                  onClick={() => updateTrack.mutate({ id: track.id, is_sequential: !track.is_sequential })}
                                  title={track.is_sequential ? 'Sequential mode ON' : 'Sequential mode OFF'}
                                >
                                  {track.is_sequential ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
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
                            className="h-8 w-8 hover:bg-[hsl(var(--warning))]/15"
                            onClick={() => handleSetPrimary(track)}
                            title={track.is_primary ? 'Remove primary' : 'Set as primary'}
                          >
                            <Star className={`w-4 h-4 ${track.is_primary ? 'fill-[hsl(var(--warning))] text-[hsl(var(--warning))]' : 'text-muted-foreground'}`} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Skill Track</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{track.skill_name}"? This will permanently remove the skill track and all its learning steps, links, and reflections.
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
                    <div className="border-t bg-gradient-to-r from-secondary/20 to-secondary/10 p-4">
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
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Daily Study Board */}
        {canEdit && (
          <div className="animate-in slide-in-from-bottom-2 duration-200">
            <DailyStudyBoard sessionId={session.id} userId={userId} />
          </div>
        )}
    </div>
  );
}